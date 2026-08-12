import { Slot } from './slot.js';

export const SLOT_CONTEXT_ATTRIBUTE = 'data-isas-slot';

export class SlotBag {
    constructor(slots = {}) {
        this.slots = Object.fromEntries(Object.entries(slots).map(
            ([name, slot]) => [name, Slot.from(slot)],
        ));
    }

    static fromNodes(nodes = []) {
        const slots = {};

        for (const source of nodes) {
            if (source.nodeType === Node.TEXT_NODE && !source.textContent.trim()) continue;

            const node = source.cloneNode(true);
            const declaredName = source.nodeType === Node.ELEMENT_NODE
                ? source.getAttribute('slot')
                : null;
            const name = declaredName
                ? declaredName
                : 'default';

            if (node.nodeType === Node.ELEMENT_NODE) {
                node.removeAttribute('slot');
                node.removeAttribute(SLOT_CONTEXT_ATTRIBUTE);
                if (declaredName) node.setAttribute(SLOT_CONTEXT_ATTRIBUTE, name);
            }
            (slots[name] ??= []).push(node);
        }

        return new SlotBag(slots);
    }

    static from(value = {}) {
        return value instanceof SlotBag ? value.clone() : new SlotBag(value);
    }

    get(name = 'default') {
        return this.slots[name]?.clone() ?? new Slot();
    }

    has(name = 'default') {
        return Boolean(this.slots[name]?.filled());
    }

    set(name = 'default', value = null) {
        this.slots[name] = Slot.from(value);
        return this;
    }

    setDefault(name = 'default', value = null) {
        if (!this.has(name)) this.set(name, value);
        return this;
    }

    prepend(name = 'default', value = null) {
        this.slots[name] = new Slot([
            ...Slot.from(value).all(),
            ...this.get(name).all(),
        ]);
        return this;
    }

    append(name = 'default', value = null) {
        this.slots[name] = new Slot([
            ...this.get(name).all(),
            ...Slot.from(value).all(),
        ]);
        return this;
    }

    clone() {
        return new SlotBag(this.slots);
    }

    names() {
        return Object.keys(this.slots);
    }
}
