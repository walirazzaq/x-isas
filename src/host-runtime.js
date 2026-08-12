import { Isas } from './isas.js';
import { AttributeBag, mergeClasses } from './support/attribute-bag.js';
import { SLOT_CONTEXT_ATTRIBUTE, SlotBag } from './support/slot-bag.js';
import { PartBag, normalizePartDescriptors } from './support/part-bag.js';
import { SourceSnapshot } from './support/source-snapshot.js';
import { AlpineScope } from './support/alpine-scope.js';
import { ATTACHMENT_SELECTOR, COMPONENT_SELECTOR } from './support/directives.js';
import { normalizeName } from './registries.js';
import { camelCase, isPlainObject } from './support/value.js';
import {
    GENERATED_COMPONENT_ATTRIBUTE,
    GENERATED_COMPONENT_CONTENT_ATTRIBUTE,
    isGeneratedComponent,
} from './support/generated-component.js';

const runtimes = new WeakMap();
const partStates = new WeakMap();
const STABLE_SLOT_ATTRIBUTE = 'data-isas-stable-slot';
const MORPH_KEY_ATTRIBUTE = 'data-isas-key';
let nextStableSlotOwnerId = 0;

function activationAttributeFor(Class) {
    const attribute = normalizeName(Class.activationAttribute);
    return Class.attachable === true && attribute ? attribute : null;
}

function declaresAttribute(attributes, name) {
    return attributes.has(name)
        || attributes.has(`:${name}`)
        || attributes.has(`x-bind:${name}`);
}

function destroyInstance(instance) {
    try {
        instance.destroy?.();
    } finally {
        instance._cleanup?.();
    }
}

function mergeAttributes(current, contribution) {
    return AttributeBag.from(contribution).merge(current);
}

function livewireOwner(element) {
    return element.closest('[wire\\:id]');
}

function ownedRuntimeElements(element) {
    const owner = livewireOwner(element);
    return [...element.querySelectorAll(`${COMPONENT_SELECTOR}, ${ATTACHMENT_SELECTOR}`)]
        .filter((node) => livewireOwner(node) === owner);
}

function renderedChildrenOwnerDirectives(element) {
    if (element?.nodeType !== Node.ELEMENT_NODE) return [];

    return [...element.attributes]
        .map(({ name }) => name)
        .filter((name) => (
            name === 'x-text'
            || name === 'x-html'
            || name === 'wire:text'
            || name.startsWith('wire:text.')
        ));
}

function directivesShareRenderedChildren(from, to) {
    return renderedChildrenOwnerDirectives(from)
        .some((name) => to?.hasAttribute?.(name));
}

function isWithinTeleport(element) {
    let node = element;
    while (node) {
        if (node._x_teleportBack) return true;
        node = node.parentElement;
    }
    return false;
}

function boundAttributeName(name) {
    let target = null;

    if (name.startsWith(':')) target = name.slice(1);
    else if (name.startsWith('x-bind:')) target = name.slice('x-bind:'.length);

    return target?.split('.', 1)[0] || null;
}

function renderAttributes(source, element, renderer) {
    let attributes = source.attributes.clone();

    for (const [name] of source.attributes.entries()) {
        const target = boundAttributeName(name);
        if (target && element.hasAttribute(target)) {
            const value = renderer.authoredAttribute(
                target,
                elementAttributeValue(element, target),
                source.attributes.get(target),
            );
            attributes = value === null
                ? attributes.remove(target)
                : attributes.set(target, value);
        }
    }

    if (attributes.has('slot')) {
        const slot = attributes.get('slot');
        attributes = attributes.remove(SLOT_CONTEXT_ATTRIBUTE).set('slot', false);
        if (slot) attributes = attributes.set(SLOT_CONTEXT_ATTRIBUTE, slot);
    }

    return attributes;
}

function adapterAttributes(value, label) {
    if (value === undefined || value === null) return new AttributeBag();
    if (value instanceof AttributeBag || isPlainObject(value)) return AttributeBag.from(value);
    throw new Error(`${label} must be an AttributeBag or a plain object.`);
}

function normalizeLocalPartContribution(value, label) {
    if (value === undefined || value === null) {
        return { host: new AttributeBag(), slots: {}, parts: {} };
    }
    if (value instanceof AttributeBag) {
        return { host: value.clone(), slots: {}, parts: {} };
    }
    if (!isPlainObject(value)) {
        throw new Error(`${label} must return an AttributeBag or a plain object.`);
    }

    const rich = Object.hasOwn(value, 'host')
        || Object.hasOwn(value, 'slots')
        || Object.hasOwn(value, 'parts');
    if (!rich) return { host: AttributeBag.from(value), slots: {}, parts: {} };

    const slots = value.slots ?? {};
    if (!isPlainObject(slots)) throw new Error(`${label} slots must be a plain object.`);
    const parts = value.parts ?? {};
    if (!isPlainObject(parts)) throw new Error(`${label} parts must be a plain object.`);

    return {
        host: adapterAttributes(value.host, `${label} host`),
        slots: Object.fromEntries(Object.entries(slots).map(([name, attributes]) => {
            const normalized = normalizeName(name);
            if (!normalized) throw new Error(`${label} slot names cannot be empty.`);
            return [normalized, adapterAttributes(attributes, `${label} slot '${normalized}'`)];
        })),
        parts: Object.fromEntries(Object.entries(parts).map(([name, attributes]) => {
            const normalized = normalizeName(name);
            if (!normalized) throw new Error(`${label} nested part names cannot be empty.`);
            return [normalized, adapterAttributes(
                attributes,
                `${label} nested part '${normalized}'`,
            )];
        })),
    };
}

function normalizeAdapterResult(value, componentName, declaredParts = new Map()) {
    if (value === undefined || value === null) {
        return { host: new AttributeBag(), parts: {}, localParts: {} };
    }
    if (!isPlainObject(value)) {
        throw new Error(`Adapter '${componentName}' must return a plain object.`);
    }

    const parts = value.parts ?? {};
    if (!isPlainObject(parts)) {
        throw new Error(`Adapter '${componentName}' parts must be a plain object.`);
    }

    const generated = {};
    const local = {};

    for (const [rawName, contribution] of Object.entries(parts)) {
        const originalName = String(rawName).trim();
        const name = normalizeName(originalName);
        if (!originalName) throw new Error(`Adapter '${componentName}' part names cannot be empty.`);

        if (declaredParts.has(name)) {
            if (typeof contribution !== 'function') {
                normalizeLocalPartContribution(
                    contribution,
                    `Adapter '${componentName}' part '${name}'`,
                );
            }
            local[name] = contribution;
        } else {
            generated[originalName] = adapterAttributes(
                contribution,
                `Adapter '${componentName}' part '${originalName}'`,
            );
        }
    }

    return {
        host: adapterAttributes(value.host, `Adapter '${componentName}' host`),
        parts: generated,
        localParts: local,
    };
}

function applyPartAttributes(attributes, parts) {
    let result = attributes;

    for (const [part, defaults] of Object.entries(parts)) {
        const merged = attributes.for(part).merge(defaults);
        for (const [name, value] of merged.entries()) {
            result = result.set(`${part}:${name}`, value);
        }
    }

    return result;
}

function flattenLocalPartContributions(localParts, componentName) {
    const flattened = {};

    for (const [name, value] of Object.entries(localParts)) {
        if (typeof value === 'function') continue;
        const contribution = normalizeLocalPartContribution(
            value,
            `Adapter '${componentName}' part '${name}'`,
        );
        flattened[name] = contribution.host;
        for (const [slot, attributes] of Object.entries(contribution.slots)) {
            flattened[`${name}:${slot}`] = attributes;
        }
        for (const [part, attributes] of Object.entries(contribution.parts)) {
            flattened[`${name}:${part}`] = attributes;
        }
    }

    return flattened;
}

function applyScopedSlotAttributes(part) {
    for (const name of part.slots.names()) {
        const slot = part.slots.get(name).attrs(part.attrs.for(name));
        part.slots.set(name, slot);
    }
    return part;
}

function markStableSlots(slots, names = [], runtime) {
    for (const rawName of names) {
        const name = normalizeName(rawName);
        if (!name || !slots.has(name)) continue;

        const nodes = slots.get(name).all();
        let index = 0;
        for (const node of nodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            node.setAttribute(
                STABLE_SLOT_ATTRIBUTE,
                `${name}:${runtime.stableSlotOwnerId}:${index}`,
            );
            index += 1;
        }
        slots.set(name, nodes);
    }

    return slots;
}

function resolveLocalParts(parts, authoredAttrs, runtime) {
    for (const part of parts.parts) {
        const localAttrs = part.attrs;
        const rootAttrs = authoredAttrs.for(part.name);
        part.attrs = localAttrs.merge(rootAttrs);
        const scopedNames = new Set([
            ...part.slots.names(),
            ...rootAttrs.entries()
                .filter(([name]) => name.includes(':'))
                .map(([name]) => name.split(':', 1)[0]),
            ...localAttrs.entries()
                .filter(([name]) => name.includes(':'))
                .map(([name]) => name.split(':', 1)[0]),
        ]);
        for (const slotName of scopedNames) {
            const merged = localAttrs.for(slotName).merge(rootAttrs.for(slotName));
            for (const [name, value] of merged.entries()) {
                part.attrs = part.attrs.set(`${slotName}:${name}`, value);
            }
        }
        part.authoredAttrs = part.attrs.clone();
        const state = runtime.partState(part.name, part.index);
        if (state) {
            state.setBaseline(part.authoredAttrs);
            part.attrs = state.resolve(part.attrs);
        }
        applyScopedSlotAttributes(part);
    }
    return parts;
}

function applyLocalPartContributions(parts, localContributions, component, componentName) {
    for (const part of parts.parts) {
        const configured = localContributions[part.name];
        const value = typeof configured === 'function'
            ? configured({
                component,
                part: part.clone(),
                attrs: part.attrs.clone(),
                slots: part.slots.clone(),
                index: part.index,
            })
            : configured;
        const contribution = normalizeLocalPartContribution(
            value,
            `Adapter '${componentName}' part '${part.name}'`,
        );

        part.managedAttributes = contribution.host.clone();
        part.attrs = applyPartAttributes(part.attrs, contribution.parts);
        part.attrs = part.attrs.merge(contribution.host);
        for (const [slotName, defaults] of Object.entries(contribution.slots)) {
            part.slots.set(slotName, part.slots.get(slotName).attrs(defaults));
        }
    }

    return parts;
}

function adapterAttributesHook(adapter) {
    if (typeof adapter === 'function') return adapter;
    return adapter?.attributes ?? null;
}

function adapterRenderHook(adapter) {
    if (typeof adapter === 'function') return null;
    return adapter?.render ?? null;
}

function mergeAuthoredAttributes(contributions, authored) {
    contributions = AttributeBag.from(contributions);
    const explicit = new AttributeBag(Object.fromEntries(
        contributions.entries()
            .filter(([name]) => authored.has(name))
            .map(([name]) => [name, authored.get(name)]),
    ));
    return explicit.merge(contributions);
}

function styleDeclaration(value) {
    const element = document.createElement('div');
    if (value) element.setAttribute('style', String(value));
    return element.style;
}

function stripManagedClasses(value, managed, baseline) {
    const managedTokens = new Set(String(managed ?? '').split(/\s+/).filter(Boolean));
    const baselineTokens = new Set(String(baseline ?? '').split(/\s+/).filter(Boolean));
    const tokens = String(value ?? '').split(/\s+/).filter(Boolean)
        .filter((token) => !managedTokens.has(token));

    for (const token of managedTokens) {
        if (baselineTokens.has(token)) tokens.push(token);
    }

    return mergeClasses(tokens) || null;
}

function stripManagedStyles(value, managed, baseline) {
    const current = styleDeclaration(value);
    const owned = styleDeclaration(managed);
    const original = styleDeclaration(baseline);

    for (let index = 0; index < owned.length; index += 1) {
        const property = owned.item(index);
        const ownedValue = owned.getPropertyValue(property);
        const ownedPriority = owned.getPropertyPriority(property);
        const originalOwnsSameValue = original.getPropertyValue(property) === ownedValue
            && original.getPropertyPriority(property) === ownedPriority;

        if (!originalOwnsSameValue
            && current.getPropertyValue(property) === ownedValue
            && current.getPropertyPriority(property) === ownedPriority) {
            current.removeProperty(property);
        }
    }

    return current.cssText || null;
}

function setElementAttribute(element, name, value) {
    const normalized = String(value);
    if (elementAttributeValue(element, name) === normalized) return;

    element.setAttribute(name, normalized);
    if (element.getAttribute(name) === normalized) return;

    const existing = element.getAttributeNode(name);
    if (existing) existing.value = normalized;
}

function elementAttributeValue(element, name) {
    if (!element.hasAttribute(name)) return null;
    return element.getAttributeNode(name)?.value ?? element.getAttribute(name);
}

function boundPartAttributeValue(element, name) {
    const bindings = element._x_bindings;
    if (!bindings || !Object.hasOwn(bindings, name) || name === 'class' || name === 'style') {
        return elementAttributeValue(element, name);
    }

    const value = globalThis.Alpine.bound(element, name);
    if (value === null || value === undefined || value === false) return null;
    return value === true ? '' : String(value);
}

function shallowPartKey(element) {
    if (!element.hasAttribute?.('x-part')) return null;
    const name = normalizeName(element.getAttribute('x-part'));
    let index = 0;
    let sibling = element.previousElementSibling;
    while (sibling) {
        if (normalizeName(sibling.getAttribute('x-part')) === name) index += 1;
        sibling = sibling.previousElementSibling;
    }
    return `x-isas-part:${name}:${index}`;
}

class HostRenderer {
    constructor(runtime) {
        this.runtime = runtime;
        this.el = runtime.el;
        this.ownedAttributes = new Set();
        this.managedAttributes = new AttributeBag();
        this.ownsHtml = false;
        this.stableSlots = new Map();
    }

    stableSlotNames() {
        return (this.runtime.component?.constructor.stableSlots ?? [])
            .map(normalizeName)
            .filter(Boolean);
    }

    captureStableSlots() {
        if (this.stableSlots.size > 0) return;

        for (const element of this.el.querySelectorAll(`[${STABLE_SLOT_ATTRIBUTE}]`)) {
            const key = element.getAttribute(STABLE_SLOT_ATTRIBUTE);
            if (key && !this.stableSlots.has(key)) this.stableSlots.set(key, element);
        }

        for (const name of this.stableSlotNames()) {
            const nodes = [...this.el.children].filter((element) => (
                normalizeName(element.getAttribute('slot')) === name
            ));
            nodes.forEach((element, index) => {
                this.stableSlots.set(
                    `${name}:${this.runtime.stableSlotOwnerId}:${index}`,
                    element,
                );
            });
        }
    }

    syncStableSlotAttributes(element, target, { restore = false } = {}) {
        const desired = new Map(
            [...target.attributes].map(({ name, value }) => [name, value]),
        );
        for (const { name } of [...element.attributes]) {
            if (!desired.has(name)) element.removeAttribute(name);
        }
        for (const { name, value } of [...target.attributes]) {
            if (element.getAttribute(name) !== value) element.setAttribute(name, value);
        }
        if (restore) element.removeAttribute(STABLE_SLOT_ATTRIBUTE);
    }

    projectStableSlots() {
        for (const [key, element] of this.stableSlots) {
            const target = this.el.querySelector(
                `[${STABLE_SLOT_ATTRIBUTE}="${CSS.escape(key)}"]`,
            );
            if (!target || target === element) continue;
            this.syncStableSlotAttributes(element, target);
            target.replaceWith(element);
        }
    }

    restoreStableSlots() {
        for (const [key, element] of this.stableSlots) {
            const [name] = key.split(':');
            const target = this.el.querySelector(
                `[${STABLE_SLOT_ATTRIBUTE}="${CSS.escape(key)}"]`,
            ) ?? [...this.el.children].find((candidate) => (
                normalizeName(candidate.getAttribute('slot')) === name
            ));
            if (!target) continue;
            const restore = target.hasAttribute('slot');
            this.syncStableSlotAttributes(element, target, { restore });
            target.replaceWith(element);
        }
    }

    apply(attributes, html, managedAttributes = {}) {
        const desired = AttributeBag.from(attributes).all();
        const managed = AttributeBag.from(managedAttributes);
        const desiredNames = new Set(Object.keys(desired));
        let renderedChildren = false;

        if (html !== undefined) {
            if (!this.ownsHtml) {
                this.ownsHtml = true;
                this.captureStableSlots();
                if (this.el.innerHTML !== html) {
                    this.el.innerHTML = html;
                    this.projectStableSlots();
                }
                renderedChildren = true;
            } else if (this.el.innerHTML !== html) {
                const target = this.el.cloneNode(false);
                target.innerHTML = html;
                const host = this.el;
                const existingGeneratedRuntimes = [...host.querySelectorAll(
                    `[${GENERATED_COMPONENT_ATTRIBUTE}]`,
                )]
                    .map((element) => HostRuntime.from(element))
                    .filter(Boolean);
                const reconciledRuntimes = new Set();
                const runtime = this.runtime;
                const renderer = this;
                globalThis.Alpine.morph(host, target, {
                    lookahead: false,
                    updating(from, to, childrenOnly, skip, skipChildren) {
                        if (from === host) {
                            childrenOnly();
                            return;
                        }

                        if (from.hasAttribute?.('x-part')
                            && partStates.get(from)?.owner === runtime
                            && normalizeName(from.getAttribute('x-part'))
                                === normalizeName(to.getAttribute?.('x-part'))) {
                            // PartHostState owns the permanent host's attributes. Morph only
                            // its rendered structure so authored Alpine bindings stay attached.
                            childrenOnly();
                            return;
                        }

                        if (from.hasAttribute?.(STABLE_SLOT_ATTRIBUTE)
                            && from.getAttribute(STABLE_SLOT_ATTRIBUTE)
                                === to.getAttribute?.(STABLE_SLOT_ATTRIBUTE)) {
                            renderer.syncStableSlotAttributes(from, to);
                            skipChildren();
                            return;
                        }

                        if (from.hasAttribute?.('data-isas-slot-owns-children')
                            && to.hasAttribute?.('data-isas-slot-owns-children')) {
                            skipChildren();
                            return;
                        }

                        if (from.nodeType === Node.ELEMENT_NODE && from.hasAttribute('wire:id')) {
                            skip();
                            return;
                        }

                        const nestedRuntime = HostRuntime.from(from);
                        if (nestedRuntime
                            && isGeneratedComponent(from)
                            && isGeneratedComponent(to)) {
                            nestedRuntime.adoptSource(to, { render: false });
                            reconciledRuntimes.add(nestedRuntime);
                            if (!nestedRuntime.component) {
                                if (from.getAttribute(GENERATED_COMPONENT_CONTENT_ATTRIBUTE) === 'morph'
                                    && to.getAttribute(GENERATED_COMPONENT_CONTENT_ATTRIBUTE) === 'morph') {
                                    // Some generated attachment hosts render dynamic parent-owned
                                    // content. Reconcile both their attributes and children while
                                    // retaining the already-mounted attachment runtime.
                                    return;
                                }
                                // Generated attachment-only hosts keep their live,
                                // attachment-managed children while Alpine morphs
                                // the generated host attributes from the new view.
                                skipChildren();
                                return;
                            }
                        }
                        if (nestedRuntime?.ownsRenderedChildren()) {
                            if (isWithinTeleport(from)) {
                                nestedRuntime.adoptSource(to, { render: false });
                                reconciledRuntimes.add(nestedRuntime);
                            }
                            skip();
                            return;
                        }
                        if (nestedRuntime) childrenOnly();
                        if (directivesShareRenderedChildren(from, to)) skipChildren();
                    },
                    key(element) {
                        if (element.nodeType !== Node.ELEMENT_NODE) return undefined;
                        const key = element.getAttribute('wire:id')
                            ?? element.getAttribute('wire:key')
                            ?? element.getAttribute(STABLE_SLOT_ATTRIBUTE)
                            ?? element.getAttribute(MORPH_KEY_ATTRIBUTE)
                            ?? element.getAttribute(GENERATED_COMPONENT_ATTRIBUTE)
                            ?? shallowPartKey(element);
                        return key || undefined;
                    },
                });
                existingGeneratedRuntimes
                    .filter((runtime) => !host.contains(runtime.el))
                    .forEach((runtime) => {
                        globalThis.Alpine.destroyTree(runtime.el);
                        if (!runtime.destroyed) runtime.destroy();
                    });
                reconciledRuntimes.forEach((runtime) => runtime.renderNow());
                renderedChildren = true;
            }
        }

        for (const name of this.ownedAttributes) {
            if (desiredNames.has(name)) continue;
            this.restoreAttribute(name);
            this.ownedAttributes.delete(name);
        }

        for (const [name, value] of Object.entries(desired)) {
            this.ownedAttributes.add(name);
            if (value === false || value === null || value === undefined) {
                this.el.removeAttribute(name);
            } else {
                setElementAttribute(this.el, name, value === true ? '' : String(value));
            }
        }

        this.managedAttributes = managed;
        if (renderedChildren) this.runtime.initializeRenderedChildren();
    }

    authoredAttribute(name, value, baseline = null) {
        if (!this.managedAttributes.has(name)) return value;

        const managed = this.managedAttributes.get(name);
        if (name === 'class') return stripManagedClasses(value, managed, baseline);
        if (name === 'style') return stripManagedStyles(value, managed, baseline);

        const normalizedManaged = managed === true ? '' : String(managed ?? '');
        return value === normalizedManaged ? baseline : value;
    }

    restoreAttribute(name) {
        const source = this.runtime.source.attributes;
        if (source.has(name)) setElementAttribute(this.el, name, source.get(name));
        else this.el.removeAttribute(name);
    }

    restore() {
        for (const name of this.ownedAttributes) this.restoreAttribute(name);
        this.ownedAttributes.clear();
        this.managedAttributes = new AttributeBag();
        if (this.ownsHtml) {
            this.el.innerHTML = this.runtime.source.innerHTML();
            this.restoreStableSlots();
        }
    }
}

class PartHostState {
    constructor(owner, el, name) {
        this.owner = owner;
        this.el = el;
        this.name = name;
        this.baseline = new AttributeBag();
        this.managedAttributes = new AttributeBag();
        this.overrides = new Map();
        this.ownedAttributes = new Set();
        this.observer = null;
    }

    setBaseline(attributes) {
        this.baseline = AttributeBag.from(attributes);
    }

    setManaged(attributes) {
        this.managedAttributes = AttributeBag.from(attributes);
    }

    apply(attributes, managedAttributes) {
        const desired = AttributeBag.from(attributes).all();
        const desiredNames = new Set(Object.keys(desired));

        for (const name of this.ownedAttributes) {
            if (desiredNames.has(name)) continue;
            if (this.baseline.has(name)) {
                setElementAttribute(this.el, name, this.baseline.get(name));
            } else {
                this.el.removeAttribute(name);
            }
        }

        for (const [name, value] of Object.entries(desired)) {
            if (value === false || value === null || value === undefined) {
                this.el.removeAttribute(name);
            } else {
                setElementAttribute(this.el, name, value === true ? '' : String(value));
            }
        }

        this.ownedAttributes = desiredNames;
        this.setManaged(managedAttributes);
    }

    authoredAttribute(name, value) {
        if (!this.managedAttributes.has(name)) return value;

        const managed = this.managedAttributes.get(name);
        const baseline = this.baseline.get(name);
        if (name === 'class') return stripManagedClasses(value, managed, baseline);
        if (name === 'style') return stripManagedStyles(value, managed, baseline);

        const normalizedManaged = managed === true ? '' : String(managed ?? '');
        return value === normalizedManaged ? baseline : value;
    }

    resolve(attributes) {
        let resolved = AttributeBag.from(attributes);
        for (const [name, value] of this.overrides) {
            resolved = value === null ? resolved.remove(name) : resolved.set(name, value);
        }
        return resolved;
    }

    start() {
        if (this.observer || typeof MutationObserver === 'undefined') return;
        this.observer = new MutationObserver((records) => {
            let changed = false;
            for (const record of records) {
                const name = record.attributeName;
                if (name === 'x-part') continue;
                const live = boundPartAttributeValue(this.el, name);
                const value = this.authoredAttribute(name, live);
                const baseline = this.baseline.has(name) ? this.baseline.get(name) : null;

                if (value === baseline) {
                    if (this.overrides.delete(name)) changed = true;
                } else if (!this.overrides.has(name) || this.overrides.get(name) !== value) {
                    this.overrides.set(name, value);
                    changed = true;
                }
            }
            if (changed) this.owner.requestRender();
        });
        this.observer.observe(this.el, { attributes: true, attributeOldValue: true });
    }

    takeRecords() {
        this.observer?.takeRecords();
    }

    reset() {
        this.overrides.clear();
    }

    destroy() {
        this.observer?.disconnect();
        this.observer = null;
        partStates.delete(this.el);
    }
}

export class HostRuntime {
    static for(el, registries = Isas) {
        let runtime = runtimes.get(el);
        if (!runtime || runtime.destroyed) {
            runtime = new HostRuntime(el, registries);
            runtimes.set(el, runtime);
        }
        return runtime;
    }

    static from(el) {
        return runtimes.get(el) ?? null;
    }

    constructor(el, registries = Isas) {
        this.el = el;
        this.registries = registries;
        this.source = SourceSnapshot.fromElement(el);
        this.stableSlotOwnerId = ++nextStableSlotOwnerId;
        this.componentSpec = null;
        this.explicitAttachmentSpecs = [];
        this.implicitAttachmentSpecs = [];
        this.attachmentSpecs = [];
        this.component = null;
        this.attachments = new Map();
        this.hostScope = null;
        this.componentScopes = new Map();
        this.destroyed = false;
        this.booted = false;
        this.retainCount = 0;
        this.renderQueued = false;
        this.observer = null;
        this.propertyCleanups = [];
        this.renderer = new HostRenderer(this);
        this.partDescriptors = new Map();
        this.connectedParts = new Set();
        this.currentParts = new PartBag();
    }

    retain() {
        this.retainCount += 1;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.retainCount = Math.max(0, this.retainCount - 1);
            if (this.retainCount === 0) this.destroy();
        };
    }

    configureComponent(specification) {
        if (this.destroyed) return;
        if (this.booted) {
            if (this.component) throw new Error('x-is cannot be reconfigured after initialization.');
            this.componentSpec = specification;
            this.reconcileImplicitAttachments();
            this.validateComposition(specification, this.attachmentSpecs);
            this.mountPrimary();
            this.ensureHostScope();
            this.mountComponentScope(this.component, specification);
            this.renderNow();
            return;
        }
        this.validateComposition(specification, this.explicitAttachmentSpecs);
        this.componentSpec = specification;
    }

    configureAttachments(specification) {
        if (this.destroyed) return;
        if (!this.booted) {
            this.validateComposition(this.componentSpec, specification);
            this.explicitAttachmentSpecs = specification;
            this.attachmentSpecs = specification;
            return;
        }

        const implicit = this.resolveImplicitAttachmentSpecs(specification);
        const combined = [...specification, ...implicit];
        this.validateComposition(this.componentSpec, combined);
        this.removeAttachments({ refreshHost: false });
        this.explicitAttachmentSpecs = specification;
        this.implicitAttachmentSpecs = implicit;
        this.attachmentSpecs = combined;
        this.mountAttachments();
        this.ensureHostScope();
        for (const spec of this.attachmentSpecs) {
            this.mountComponentScope(this.attachments.get(spec.name), spec);
        }
        this.syncScopes(this.renderAttributes());
    }

    boot() {
        if (this.booted || this.destroyed) return;
        this.booted = true;
        this.implicitAttachmentSpecs = this.resolveImplicitAttachmentSpecs();
        this.attachmentSpecs = [
            ...this.explicitAttachmentSpecs,
            ...this.implicitAttachmentSpecs,
        ];
        this.validateComposition();
        this.installBoundPropertyBridges();
        this.mountAttachments();
        this.mountPrimary();
        this.ensureHostScope();
        for (const spec of this.attachmentSpecs) {
            this.mountComponentScope(this.attachments.get(spec.name), spec);
        }
        if (this.component) this.mountComponentScope(this.component, this.componentSpec);
        this.startObserver();
        if (this.component) this.renderNow({ applyHost: false });
        this.renderQueued = true;
        globalThis.Alpine.nextTick(() => {
            this.renderQueued = false;
            if (!this.destroyed && this.component) this.renderNow();
        });
    }

    validateComposition(componentSpec = this.componentSpec, attachmentSpecs = this.attachmentSpecs) {
        const names = new Set();
        const namespaces = new Set();
        if (componentSpec) {
            names.add(componentSpec.name);
            namespaces.add(componentSpec.namespace);
        }
        for (const spec of attachmentSpecs) {
            if (names.has(spec.name)) {
                throw new Error(`Component '${spec.name}' cannot be both x-is and x-as on one host.`);
            }
            if (namespaces.has(spec.namespace)) {
                throw new Error(`x-isas namespace '${spec.namespace}' is already in use on this host.`);
            }
            names.add(spec.name);
            namespaces.add(spec.namespace);
        }
    }

    resolveImplicitAttachmentSpecs(explicit = this.explicitAttachmentSpecs) {
        if (!this.componentSpec) return [];

        const occupiedNames = new Set(explicit.map((spec) => spec.name));
        const specs = [];

        for (const [name, Class] of this.registries.components.entries()) {
            const attribute = activationAttributeFor(Class);
            if (!attribute
                || name === this.componentSpec?.name
                || occupiedNames.has(name)
                || !declaresAttribute(this.source.attributes, attribute)) {
                continue;
            }

            specs.push({
                name,
                Class,
                namespace: Class.defaultNamespace ?? `$${camelCase(name)}`,
                config: Object.freeze({}),
                scoped: Class.scoped !== false,
                implicit: true,
                activationAttribute: attribute,
            });
        }

        return specs;
    }

    reconcileImplicitAttachments() {
        if (this.destroyed) return;

        const desired = this.resolveImplicitAttachmentSpecs();
        const combined = [...this.explicitAttachmentSpecs, ...desired];
        this.validateComposition(this.componentSpec, combined);

        if (!this.booted) {
            this.implicitAttachmentSpecs = desired;
            this.attachmentSpecs = combined;
            return;
        }

        const desiredNames = new Set(desired.map((spec) => spec.name));
        const currentNames = new Set(this.implicitAttachmentSpecs.map((spec) => spec.name));

        for (const name of currentNames) {
            if (desiredNames.has(name)) continue;
            this.destroyAttachment(name);
        }

        this.implicitAttachmentSpecs = desired;
        this.attachmentSpecs = combined;

        for (const spec of desired) {
            if (this.attachments.has(spec.name)) continue;
            const instance = this.createInstance(spec, 'attachment');
            this.attachments.set(spec.name, instance);
            instance.mount?.();
            this.mountComponentScope(instance, spec);
        }

        this.ensureHostScope();
        this.syncScopes(this.renderAttributes());
    }

    isActivationMutation(name) {
        return this.registries.components.entries().some(([, Class]) => (
            activationAttributeFor(Class) === name
        ));
    }

    sourceSlots() {
        return SlotBag.fromNodes(this.source.childNodes().filter((node) => !(
            node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('x-part')
        )));
    }

    setFunctionalContext(instance) {
        if (!instance) return;
        instance._setRenderContext({
            attrs: this.renderAttributes().clone(),
            slots: this.sourceSlots().clone(),
            parts: new PartBag(),
            source: this.source,
        });
    }

    createInstance(spec, mode) {
        const instance = new spec.Class();
        instance._initialize({
            el: this.el,
            runtime: this,
            name: spec.name,
            namespace: spec.namespace,
            mode,
            config: spec.config ?? Object.freeze({}),
        });
        this.setFunctionalContext(instance);
        return instance;
    }

    mountAttachments() {
        for (const spec of this.attachmentSpecs) {
            const instance = this.createInstance(spec, 'attachment');
            this.attachments.set(spec.name, instance);
            instance.mount?.();
        }
    }

    destroyAttachment(name) {
        const instance = this.attachments.get(name);
        if (!instance) return;
        this.destroyComponentScope(instance);
        destroyInstance(instance);
        this.attachments.delete(name);
    }

    mountPrimary() {
        if (!this.componentSpec || this.component) return;
        this.component = this.createInstance(this.componentSpec, 'primary');
        this.partDescriptors = normalizePartDescriptors(
            this.componentSpec.name,
            this.componentSpec.Class.parts ?? {},
        );
        this.component.mount?.();
    }

    scopedInstances() {
        const instances = this.attachmentSpecs
            .filter((spec) => spec.scoped)
            .map((spec) => [this.attachments.get(spec.name), spec])
            .filter(([instance]) => instance);
        if (this.component && this.componentSpec?.scoped) {
            instances.push([this.component, this.componentSpec]);
        }
        return instances;
    }

    ensureHostScope() {
        const shouldExist = this.scopedInstances().length > 0;
        if (shouldExist && !this.hostScope) {
            this.hostScope = new AlpineScope(this.el, '$host').mount(this.renderAttributes());
        } else if (!shouldExist && this.hostScope) {
            this.hostScope.destroy();
            this.hostScope = null;
        }
    }

    mountComponentScope(instance, spec) {
        if (!instance || !spec?.scoped || this.componentScopes.has(instance)) return;
        const scope = new AlpineScope(this.el, spec.namespace, instance)
            .mount(this.renderAttributes());
        this.componentScopes.set(instance, scope);
    }

    destroyComponentScope(instance) {
        const scope = this.componentScopes.get(instance);
        scope?.destroy();
        this.componentScopes.delete(instance);
    }

    syncScopes(attributes, options = {}) {
        this.hostScope?.syncAll(attributes, options);
        for (const scope of this.componentScopes.values()) scope.syncAll(attributes);
    }

    componentFor(name) {
        const normalized = normalizeName(name);
        if (this.component?.name === normalized) return this.component;
        return this.attachments.get(normalized) ?? null;
    }

    closestComponent(name, { includeSelf = false } = {}) {
        let node = includeSelf ? this.el : this.el.parentElement;
        while (node) {
            const component = HostRuntime.from(node)?.componentFor(name);
            if (component) return component;
            node = node.parentElement;
        }
        return null;
    }

    removeExplicitAttachments({ refreshHost = true } = {}) {
        if (this.destroyed) return;
        if (!this.booted) {
            this.explicitAttachmentSpecs = [];
            this.implicitAttachmentSpecs = this.resolveImplicitAttachmentSpecs([]);
            this.attachmentSpecs = [...this.implicitAttachmentSpecs];
            return;
        }
        for (const instance of [...this.attachments.values()].reverse()) {
            this.destroyComponentScope(instance);
            destroyInstance(instance);
        }
        this.attachments.clear();
        this.explicitAttachmentSpecs = [];
        this.implicitAttachmentSpecs = this.resolveImplicitAttachmentSpecs([]);
        this.attachmentSpecs = [...this.implicitAttachmentSpecs];
        this.mountAttachments();
        for (const spec of this.attachmentSpecs) {
            this.mountComponentScope(this.attachments.get(spec.name), spec);
        }
        if (refreshHost) this.ensureHostScope();
    }

    removeAttachments({ refreshHost = true } = {}) {
        if (this.destroyed) return;
        if (!this.booted) {
            this.explicitAttachmentSpecs = [];
            this.implicitAttachmentSpecs = [];
            this.attachmentSpecs = [];
            return;
        }
        for (const instance of [...this.attachments.values()].reverse()) {
            this.destroyComponentScope(instance);
            destroyInstance(instance);
        }
        this.attachments.clear();
        this.explicitAttachmentSpecs = [];
        this.implicitAttachmentSpecs = [];
        this.attachmentSpecs = [];
        if (refreshHost) this.ensureHostScope();
    }

    removeComponent() {
        if (this.destroyed) return;
        if (!this.booted) {
            this.componentSpec = null;
            return;
        }
        if (this.component) {
            this.destroyComponentScope(this.component);
            destroyInstance(this.component);
            this.component = null;
            this.renderer.restore();
        }
        for (const state of [...this.connectedParts]) state.destroy();
        this.connectedParts.clear();
        this.componentSpec = null;
        this.partDescriptors = new Map();
        this.currentParts = new PartBag();
        this.reconcileImplicitAttachments();
        this.ensureHostScope();
    }

    mutateHost(callback) {
        const result = callback(this.el);
        this.observer?.takeRecords();
        return result;
    }

    directPartElements(name = null) {
        const normalized = name === null ? null : normalizeName(name);
        return [...this.el.children].filter((element) => {
            if (!element.hasAttribute('x-part')) return false;
            return normalized === null
                || normalizeName(element.getAttribute('x-part')) === normalized;
        });
    }

    partState(name, index) {
        const element = this.directPartElements(name)[index] ?? null;
        return element ? partStates.get(element) ?? null : null;
    }

    syncPartStates(parts) {
        for (const part of parts.parts) {
            if (part.generated) continue;
            const state = this.partState(part.name, part.index);
            if (!state) continue;
            state.setBaseline(part.authoredAttrs);
            state.apply(part.attrs, part.managedAttributes);
            state.takeRecords();
        }
    }

    connectPart(el, expression) {
        if (el.parentElement !== this.el) {
            throw new Error(`Component '${this.component?.name ?? 'element'}' only allows x-part on direct children.`);
        }

        const name = normalizeName(expression);
        if (!name || !this.partDescriptors.has(name)) {
            throw new Error(`Component '${this.component?.name ?? 'element'}' does not declare part '${name || expression}'.`);
        }

        let state = partStates.get(el);
        if (!state) {
            state = new PartHostState(this, el, name);
            partStates.set(el, state);
            this.connectedParts.add(state);
            state.start();
        }

        const index = this.directPartElements(name).indexOf(el);
        const renderedPart = this.currentParts?.parts.find((part) => (
            part.name === name && part.index === index
        ));
        if (renderedPart) {
            state.setBaseline(renderedPart.authoredAttrs);
            state.setManaged(renderedPart.managedAttributes);
        }

        return () => {
            this.connectedParts.delete(state);
            state.destroy();
        };
    }

    installBoundPropertyBridges() {
        const targets = new Set(this.source.attributes.entries()
            .map(([name]) => boundAttributeName(name))
            .filter(Boolean));

        if (!targets.has('value') || 'value' in this.el) return;

        Object.defineProperty(this.el, 'value', {
            configurable: true,
            get: () => this.el.getAttribute('value') ?? '',
            set: (value) => {
                const normalized = value === null || value === undefined ? '' : String(value);
                if (this.el.getAttribute('value') !== normalized) {
                    this.el.setAttribute('value', normalized);
                }
            },
        });
        this.propertyCleanups.push(() => delete this.el.value);
    }

    ownsRenderedChildren() {
        if (this.component?.constructor.structural === true) return true;

        return this.source.attributes.entries().some(([name]) => (
            name === 'x-text'
            || name === 'x-html'
            || name === 'wire:text'
            || name.startsWith('wire:text.')
        ));
    }

    initializeRenderedChildren() {
        queueMicrotask(() => {
            if (this.destroyed || !this.el.isConnected) return;
            for (const child of this.el.children) globalThis.Alpine.initTree(child);
        });
    }

    requestRender() {
        if (this.destroyed || !this.booted || !this.component || this.renderQueued) return;
        this.renderQueued = true;
        queueMicrotask(() => {
            this.renderQueued = false;
            if (!this.destroyed) this.renderNow();
        });
    }

    renderAttributes() {
        return renderAttributes(this.source, this.el, this.renderer);
    }

    processAttributeRecords(records) {
        for (const record of records) {
            if (record.type !== 'attributes') continue;
            const name = record.attributeName;
            const liveValue = elementAttributeValue(this.el, name);
            const value = this.renderer.authoredAttribute(
                name,
                liveValue,
                this.source.attributes.get(name),
            );
            this.source.setAttribute(name, value);
            if (this.isActivationMutation(name)) this.reconcileImplicitAttachments();
            for (const instance of this.attachments.values()) this.setFunctionalContext(instance);
            this.setFunctionalContext(this.component);
            this.hostScope?.attributeChanged(name, value);
            for (const scope of this.componentScopes.values()) {
                scope.attributeChanged(name, value);
            }
            for (const instance of this.attachments.values()) {
                instance.attributeChanged?.(name, record.oldValue, value);
            }
            this.component?.attributeChanged?.(name, record.oldValue, value);
        }
        if (records.length && this.component) this.requestRender();
    }

    renderNow({ applyHost = true } = {}) {
        if (this.destroyed || !this.component) return;

        // Alpine's x-bind runs after x-is/x-as. Consume those authored changes
        // before rendering so attachments mount with their resolved attributes
        // instead of losing the records when managed render mutations are drained.
        this.processAttributeRecords(this.observer?.takeRecords() ?? []);

        for (const instance of this.attachments.values()) this.setFunctionalContext(instance);
        const authoredAttrs = this.renderAttributes();
        const sourceNodes = this.source.childNodes();
        const parts = resolveLocalParts(PartBag.fromNodes(sourceNodes, {
            componentName: this.componentSpec?.name ?? 'element',
            descriptors: this.partDescriptors,
        }), authoredAttrs, this);
        const slots = markStableSlots(SlotBag.fromNodes(sourceNodes.filter((node) => !(
            node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('x-part')
        ))), this.component.constructor.stableSlots, this);
        const adapter = this.registries.adapters?.get(this.componentSpec?.name);
        const attributesHook = adapterAttributesHook(adapter);
        const adapted = normalizeAdapterResult(attributesHook?.call(adapter, {
            component: this.component,
            attrs: authoredAttrs.clone(),
            slots: slots.clone(),
            parts: parts.clone(),
        }), this.componentSpec?.name ?? 'element', this.partDescriptors);
        this.component._generatedPartAttributes = adapted.parts;
        const attrs = applyPartAttributes(
            applyPartAttributes(authoredAttrs, adapted.parts),
            flattenLocalPartContributions(
                adapted.localParts,
                this.componentSpec?.name ?? 'element',
            ),
        );
        applyLocalPartContributions(
            parts,
            adapted.localParts,
            this.component,
            this.componentSpec?.name ?? 'element',
        );

        this.component._setRenderContext({ attrs, slots, parts, source: this.source });
        for (const part of parts.parts) part.prepare(this.component);
        const view = this.component._prepareRenderContext();
        this.currentParts = this.component.parts;

        let hostContributions = adapted.host;
        hostContributions = mergeAttributes(
            hostContributions,
            this.component.hostAttributes?.() ?? {},
        );
        const hostAttributes = mergeAuthoredAttributes(hostContributions, authoredAttrs);
        let defaultInvoked = false;
        let defaultRendered;
        const renderDefault = () => {
            if (!defaultInvoked) {
                defaultInvoked = true;
                defaultRendered = this.component.render?.();
            }
            return defaultRendered;
        };
        const renderHook = adapterRenderHook(adapter);
        const rendered = renderHook
            ? renderHook.call(adapter, {
                component: this.component,
                attrs: this.component.attrs.clone(),
                slots: this.component.slots.clone(),
                parts: this.component.parts.clone(),
                view,
                renderDefault,
            })
            : renderDefault();
        const html = rendered === undefined ? undefined : String(rendered ?? '');
        this.renderer.apply(
            applyHost ? hostAttributes : {},
            html,
            applyHost ? hostContributions : {},
        );
        this.syncScopes(this.renderAttributes());
        this.syncPartStates(this.component.parts);
        for (const state of this.connectedParts) state.takeRecords();
        this.observer?.takeRecords();
    }

    startObserver() {
        if (this.observer || typeof MutationObserver === 'undefined') return;

        this.observer = new MutationObserver((records) => this.processAttributeRecords(records));

        this.observer.observe(this.el, { attributes: true, attributeOldValue: true });
    }

    adoptSource(element, { render = true } = {}) {
        const next = SourceSnapshot.fromElement(element);
        if (next.outerHTML() === this.source.outerHTML()) return false;

        this.source = next;
        for (const state of this.connectedParts) state.reset();
        this.reconcileImplicitAttachments();
        for (const instance of this.attachments.values()) this.setFunctionalContext(instance);
        this.setFunctionalContext(this.component);
        const attributes = this.renderAttributes();
        const preserveHost = this.component?.constructor.preserveHostDuringMorph === true;
        this.syncScopes(attributes, { syncHost: !preserveHost });
        for (const instance of this.attachments.values()) instance.sourceChanged?.();
        this.component?.sourceChanged?.();
        if (render && this.component) this.renderNow();
        return true;
    }

    reconcileFrom(element) {
        const liveChildren = ownedRuntimeElements(this.el)
            .filter((node) => !isGeneratedComponent(node))
            .map((node) => HostRuntime.from(node))
            .filter(Boolean);
        const incomingChildren = ownedRuntimeElements(element)
            .filter((node) => !isGeneratedComponent(node));
        const nested = [];

        for (let index = 0; index < Math.min(liveChildren.length, incomingChildren.length); index += 1) {
            const runtime = liveChildren[index];
            if (runtime.adoptSource(incomingChildren[index], { render: false })) nested.push(runtime);
        }

        const changed = this.adoptSource(element, { render: false });
        if (!changed && nested.length === 0) return false;

        if (this.component) this.renderNow();
        nested.forEach((runtime) => {
            if (runtime.component) runtime.renderNow();
        });
        return true;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.observer?.disconnect();
        this.observer = null;

        if (this.component) {
            this.destroyComponentScope(this.component);
            destroyInstance(this.component);
            this.component = null;
        }
        for (const instance of [...this.attachments.values()].reverse()) {
            this.destroyComponentScope(instance);
            destroyInstance(instance);
        }
        this.attachments.clear();
        this.hostScope?.destroy();
        this.hostScope = null;

        for (const state of [...this.connectedParts]) state.destroy();
        this.connectedParts.clear();

        for (const cleanup of this.propertyCleanups.splice(0).reverse()) cleanup();
        if (this.el.isConnected) this.renderer.restore();
        runtimes.delete(this.el);
    }
}

export function hasParentRuntime(el, boundary = null) {
    let node = el.parentElement;
    while (node && (!boundary || boundary.contains(node))) {
        const runtime = HostRuntime.from(node);
        if (runtime && !runtime.destroyed && runtime.ownsRenderedChildren()) return true;
        node = node.parentElement;
    }
    return false;
}
