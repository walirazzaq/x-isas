import { AttributeBag } from './attribute-bag.js';

export class Slot {
    static from(value = null) {
        if (value instanceof Slot) return value.clone();

        if (typeof value === 'string') {
            const template = document.createElement('template');
            template.innerHTML = value;
            return new Slot([...template.content.childNodes]);
        }

        if (value instanceof Node) return new Slot([value]);
        if (Array.isArray(value)) return new Slot(value);
        return new Slot();
    }

    constructor(nodes = []) {
        this.nodes = nodes
            .filter((node) => node instanceof Node)
            .map((node) => node.cloneNode(true));
    }

    all() {
        return this.nodes.map((node) => node.cloneNode(true));
    }

    clone() {
        return new Slot(this.nodes);
    }

    filled() {
        return this.nodes.length > 0;
    }

    empty() {
        return !this.filled();
    }

    attrs(attributes = {}) {
        const first = this.nodes.find((node) => node.nodeType === Node.ELEMENT_NODE);
        if (!first) return this;

        const merged = AttributeBag.fromElement(first).merge(attributes);
        const desired = merged.all();

        for (const attribute of [...first.attributes]) {
            if (!Object.hasOwn(desired, attribute.name)) first.removeAttribute(attribute.name);
        }

        for (const [name, value] of Object.entries(desired)) {
            if (value === false || value === null || value === undefined) first.removeAttribute(name);
            else first.setAttribute(name, value === true ? '' : String(value));
        }

        return this;
    }

    text() {
        return this.nodes
            .map((node) => node.textContent ?? '')
            .join('');
    }

    html() {
        return this.nodes.map((node) => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
            if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.textContent ?? ''}-->`;
            return node.outerHTML ?? node.textContent ?? '';
        }).join('');
    }

    toString() {
        return this.html();
    }
}
