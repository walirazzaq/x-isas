import { normalizeName } from '../registries.js';
import { hasComponentDirective } from './directives.js';
import { Part } from './part.js';
import { isPlainObject } from './value.js';

export function normalizePartDescriptors(componentName, definitions = {}) {
    if (!isPlainObject(definitions)) {
        throw new Error(`Component '${componentName}' static parts must be a plain object.`);
    }

    const descriptors = new Map();
    for (const [rawName, definition] of Object.entries(definitions)) {
        const name = normalizeName(rawName);
        if (!name) throw new Error(`Component '${componentName}' part names cannot be empty.`);
        if (descriptors.has(name)) {
            throw new Error(`Component '${componentName}' declares duplicate part '${name}'.`);
        }

        const descriptor = definition ?? {};
        if (!isPlainObject(descriptor)) {
            throw new Error(`Component '${componentName}' part '${name}' must be a descriptor object.`);
        }
        if (descriptor.tag !== undefined
            && (typeof descriptor.tag !== 'string' || !descriptor.tag.trim())) {
            throw new Error(`Component '${componentName}' part '${name}' tag must be a non-empty string.`);
        }
        if (descriptor.prepare !== undefined && typeof descriptor.prepare !== 'function') {
            throw new Error(`Component '${componentName}' part '${name}' prepare must be a function.`);
        }
        if (descriptor.render !== undefined && typeof descriptor.render !== 'function') {
            throw new Error(`Component '${componentName}' part '${name}' render must be a function.`);
        }

        descriptors.set(name, Object.freeze({ ...descriptor, tag: descriptor.tag?.trim() }));
    }

    return descriptors;
}

function dynamicPartAttribute(element) {
    return element.hasAttribute(':x-part') || element.hasAttribute('x-bind:x-part');
}

function nestedPartOwnedBy(element) {
    if (hasComponentDirective(element)) return null;

    const candidates = element.querySelectorAll('[x-part], [\\:x-part], [x-bind\\:x-part]');

    return [...candidates].find((candidate) => {
        let ancestor = candidate.parentElement;
        while (ancestor && ancestor !== element) {
            if (hasComponentDirective(ancestor)) return false;
            ancestor = ancestor.parentElement;
        }
        return true;
    }) ?? null;
}

function validatePartHost(element, componentName, descriptors, direct) {
    if (dynamicPartAttribute(element)) {
        throw new Error(`Component '${componentName}' x-part names must be literal.`);
    }
    if (!element.hasAttribute('x-part')) return null;
    if (!direct) {
        throw new Error(`Component '${componentName}' only allows x-part on direct children.`);
    }
    if (element.hasAttribute('slot')) {
        throw new Error(`Component '${componentName}' x-part cannot also declare slot.`);
    }
    if (hasComponentDirective(element)) {
        throw new Error(`Component '${componentName}' x-part cannot also declare x-is.`);
    }
    if (element.hasAttribute('x-as')
        || element.hasAttribute('x-as.scoped')
        || element.hasAttribute('x-as.unscoped')) {
        throw new Error(`Component '${componentName}' x-part cannot also declare x-as.`);
    }

    const name = normalizeName(element.getAttribute('x-part'));
    if (!name) throw new Error(`Component '${componentName}' x-part requires a literal part name.`);
    if (!descriptors.has(name)) {
        throw new Error(`Component '${componentName}' does not declare part '${name}'.`);
    }
    if (nestedPartOwnedBy(element)) {
        throw new Error(`Component '${componentName}' does not allow nested x-part boundaries.`);
    }

    return name;
}

/** Ordered collection of shallow component occurrences. */
export class PartBag {
    static fromNodes(nodes = [], { componentName = 'element', descriptors = new Map() } = {}) {
        const parts = [];
        const counts = new Map();

        nodes.forEach((node, position) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const name = validatePartHost(node, componentName, descriptors, true);
            if (name) {
                const index = counts.get(name) ?? 0;
                counts.set(name, index + 1);
                parts.push(Part.fromElement(node, {
                    name,
                    descriptor: descriptors.get(name),
                    index,
                    position,
                }));
                return;
            }

            const nested = nestedPartOwnedBy(node);
            if (nested) validatePartHost(nested, componentName, descriptors, false);
        });

        return new PartBag(parts);
    }

    static from(value = []) {
        return value instanceof PartBag ? value.clone() : new PartBag(value);
    }

    constructor(parts = []) {
        this.parts = parts.filter((part) => part instanceof Part).map((part) => part.clone());
    }

    has(name) {
        return this.parts.some((part) => part.name === normalizeName(name));
    }

    first(name) {
        return this.parts.find((part) => part.name === normalizeName(name))?.clone() ?? null;
    }

    all(name) {
        const normalized = normalizeName(name);
        return this.parts.filter((part) => part.name === normalized).map((part) => part.clone());
    }

    ordered() {
        return [...this.parts]
            .sort((left, right) => left.position - right.position || left.index - right.index)
            .map((part) => part.clone());
    }

    add(part) {
        if (!(part instanceof Part)) throw new Error('PartBag.add requires a Part.');
        this.parts.push(part.clone());
        return this;
    }

    replace(part) {
        const index = this.parts.findIndex((candidate) => (
            candidate.name === part.name && candidate.index === part.index
        ));
        if (index === -1) this.parts.push(part.clone());
        else this.parts[index] = part.clone();
        return this;
    }

    clone() {
        return new PartBag(this.parts);
    }
}
