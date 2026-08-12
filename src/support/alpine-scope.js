import { AttributeBag } from './attribute-bag.js';
import { GENERATED_COMPONENT_ATTRIBUTE } from './generated-component.js';
import { SLOT_CONTEXT_ATTRIBUTE } from './slot-bag.js';
import { camelCase } from './value.js';

function parseValue(value) {
    if (value === '') return true;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value !== null && value !== '' && !Number.isNaN(Number(value))) return Number(value);

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function shouldIgnore(name) {
    return name === 'class'
        || name === 'style'
        || name === 'el'
        || name === 'slot'
        || name === GENERATED_COMPONENT_ATTRIBUTE
        || name === SLOT_CONTEXT_ATTRIBUTE
        || name.startsWith('x-')
        || name.startsWith('@')
        || name.startsWith('wire:')
        || name.includes(':');
}

/** One stable Alpine namespace backed by the host's canonical attributes. */
export class AlpineScope {
    constructor(el, namespace, contributor = null) {
        this.el = el;
        this.namespace = namespace;
        this.contributor = contributor;
        this.members = new Set(['el']);
        this.state = globalThis.Alpine.reactive({ el });
        this.cleanup = null;
    }

    mount(attributes) {
        const scope = { [this.namespace]: this.state };
        this.cleanup = globalThis.Alpine.addScopeToNode(this.el, scope);
        this.syncAll(attributes);
        if (this.contributor) this.mergeContributor();
        return this;
    }

    mergeContributor() {
        const contribution = this.contributor.mergeScope();
        const origin = `component '${this.contributor.name}'`;
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new TypeError(`${origin} mergeScope() must return an object.`);
        }

        for (const [name, descriptor] of Object.entries(
            Object.getOwnPropertyDescriptors(contribution),
        )) {
            if (name === 'el') {
                console.warn(
                    `x-isas namespace '${this.namespace}' member 'el' from ${origin} `
                    + 'cannot override the core scope.',
                );
                continue;
            }

            this.members.add(name);
            Object.defineProperty(
                this.state,
                name,
                this.normalizeDescriptor(descriptor),
            );
        }
    }

    normalizeDescriptor(descriptor) {
        if (descriptor.get || descriptor.set) {
            return {
                configurable: true,
                enumerable: descriptor.enumerable,
                get: descriptor.get?.bind(this.contributor),
                set: descriptor.set?.bind(this.contributor),
            };
        }

        if (typeof descriptor.value === 'function') {
            return {
                configurable: true,
                enumerable: descriptor.enumerable,
                writable: false,
                value: descriptor.value.bind(this.contributor),
            };
        }

        return {
            configurable: true,
            enumerable: descriptor.enumerable,
            writable: true,
            value: descriptor.value,
        };
    }

    syncAll(attributes = AttributeBag.fromElement(this.el), { syncHost = false } = {}) {
        attributes = AttributeBag.from(attributes);
        const present = new Set();

        for (const [name, value] of attributes.entries()) {
            if (shouldIgnore(name)) continue;
            const property = camelCase(name);
            present.add(property);
            if (syncHost && this.el.getAttribute(name) !== String(value)) {
                this.el.setAttribute(name, value);
            }
            if (!this.members.has(property)) this.state[property] = parseValue(value);
        }

        if (syncHost) {
            for (const attribute of [...this.el.attributes]) {
                if (shouldIgnore(attribute.name)) continue;
                if (!present.has(camelCase(attribute.name))) this.el.removeAttribute(attribute.name);
            }
        }

        for (const property of Object.keys(this.state)) {
            if (!this.members.has(property) && !present.has(property)) delete this.state[property];
        }
    }

    attributeChanged(name, value) {
        if (shouldIgnore(name)) return;
        const property = camelCase(name);
        if (this.members.has(property)) return;
        if (value === null) delete this.state[property];
        else this.state[property] = parseValue(value);
    }

    destroy() {
        this.cleanup?.();
        this.cleanup = null;
    }
}
