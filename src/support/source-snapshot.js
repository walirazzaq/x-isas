import { AttributeBag } from './attribute-bag.js';

export class SourceSnapshot {
    static fromElement(element) {
        return new SourceSnapshot(
            element.localName,
            AttributeBag.fromElement(element),
            [...element.childNodes],
        );
    }

    constructor(tagName, attributes, children = []) {
        this.tagName = tagName;
        this.attributes = AttributeBag.from(attributes);
        this.children = children.map((node) => node.cloneNode(true));
    }

    setAttribute(name, value) {
        this.attributes = value === null
            ? this.attributes.remove(name)
            : this.attributes.set(name, value);
    }

    childNodes() {
        return this.children.map((node) => node.cloneNode(true));
    }

    innerHTML() {
        const template = document.createElement('template');
        template.content.append(...this.childNodes());
        return template.innerHTML;
    }

    outerHTML() {
        const element = document.createElement(this.tagName);
        for (const [name, value] of this.attributes.entries()) {
            element.setAttribute(name, value);
        }
        element.append(...this.childNodes());
        return element.outerHTML;
    }
}
