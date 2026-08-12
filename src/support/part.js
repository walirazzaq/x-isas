import { AttributeBag } from './attribute-bag.js';
import { renderElement } from './html.js';
import { SlotBag } from './slot-bag.js';

// Part source text must be escaped by the browser's HTML serializer.
function serializePartNodes(nodes) {
    const template = document.createElement('template');
    template.content.append(...nodes.map((node) => node.cloneNode(true)));
    return template.innerHTML;
}

function captureLayout(nodes) {
    const counts = new Map();
    const layout = nodes.map((source) => {
        if (source.nodeType === Node.TEXT_NODE && !source.textContent.trim()) {
            return { literal: source.textContent };
        }

        const name = source.nodeType === Node.ELEMENT_NODE
            ? source.getAttribute('slot') || 'default'
            : 'default';
        const index = counts.get(name) ?? 0;
        counts.set(name, index + 1);
        return { name, index };
    });

    return { layout, counts: Object.fromEntries(counts) };
}

/** A single parent-local shallow component occurrence. */
export class Part {
    static fromElement(element, { name, descriptor, index = 0, position = 0 } = {}) {
        const nodes = [...element.childNodes];
        return new Part({
            name,
            descriptor,
            index,
            position,
            tagName: element.localName,
            attrs: AttributeBag.fromElement(element),
            slots: SlotBag.fromNodes(nodes),
            ...captureLayout(nodes),
            generated: false,
        });
    }

    static generated(name, {
        descriptor = {},
        index = 0,
        position = Number.MAX_SAFE_INTEGER,
        tagName = null,
        attrs = {},
        slots = {},
    } = {}) {
        const normalizedSlots = SlotBag.from(slots);
        const counts = Object.fromEntries(normalizedSlots.names().map(
            (slotName) => [slotName, normalizedSlots.get(slotName).all().length],
        ));
        const layout = normalizedSlots.names().flatMap((slotName) => (
            Array.from({ length: counts[slotName] }, (_, slotIndex) => ({
                name: slotName,
                index: slotIndex,
            }))
        ));
        return new Part({
            name,
            descriptor,
            index,
            position,
            tagName: tagName ?? descriptor.tag ?? 'div',
            attrs,
            slots: normalizedSlots,
            layout,
            counts,
            generated: true,
        });
    }

    constructor({
        name,
        descriptor = {},
        index = 0,
        position = 0,
        tagName = 'div',
        attrs = {},
        slots = {},
        layout = [],
        counts = {},
        generated = false,
    }) {
        this.name = name;
        this.descriptor = descriptor;
        this.index = index;
        this.position = position;
        this.tagName = tagName;
        this.attrs = AttributeBag.from(attrs);
        this.authoredAttrs = this.attrs.clone();
        this.slots = SlotBag.from(slots);
        this.layout = layout.map((entry) => ({ ...entry }));
        this.layoutCounts = { ...counts };
        this.generated = generated;
        this.view = undefined;
        this.component = null;
        this.managedAttributes = new AttributeBag();
    }

    clone() {
        const clone = new Part({
            name: this.name,
            descriptor: this.descriptor,
            index: this.index,
            position: this.position,
            tagName: this.tagName,
            attrs: this.attrs,
            slots: this.slots,
            layout: this.layout,
            counts: this.layoutCounts,
            generated: this.generated,
        });
        clone.view = this.view;
        clone.component = this.component;
        clone.authoredAttrs = this.authoredAttrs.clone();
        clone.managedAttributes = this.managedAttributes.clone();
        return clone;
    }

    prepare(component) {
        this.component = component;
        this.view = this.descriptor.prepare?.({
            component,
            part: this,
            attrs: this.attrs,
            slots: this.slots,
            index: this.index,
        });
        return this.view;
    }

    innerHtml(component = this.component) {
        let defaultInvoked = false;
        let defaultRendered;
        const renderDefault = () => {
            if (!defaultInvoked) {
                defaultInvoked = true;
                const nodesBySlot = Object.fromEntries(this.slots.names().map(
                    (name) => [name, this.slots.get(name).all()],
                ));
                const rendered = [];
                for (const entry of this.layout) {
                    if (Object.hasOwn(entry, 'literal')) {
                        rendered.push(entry.literal);
                        continue;
                    }

                    const nodes = nodesBySlot[entry.name] ?? [];
                    const node = nodes[entry.index];
                    if (node) rendered.push(serializePartNodes([node]));
                    if (entry.index === (this.layoutCounts[entry.name] ?? 0) - 1
                        && nodes.length > entry.index + 1) {
                        rendered.push(serializePartNodes(nodes.slice(entry.index + 1)));
                    }
                }
                for (const [name, nodes] of Object.entries(nodesBySlot)) {
                    if ((this.layoutCounts[name] ?? 0) === 0 && nodes.length) {
                        rendered.push(serializePartNodes(nodes));
                    }
                }
                defaultRendered = rendered.join('');
            }
            return defaultRendered;
        };
        const rendered = this.descriptor.render?.({
            component,
            part: this,
            attrs: this.attrs,
            slots: this.slots,
            view: this.view,
            index: this.index,
            renderDefault,
        });

        if (rendered === undefined) return String(renderDefault() ?? '');
        return String(rendered ?? '');
    }

    html(component = this.component) {
        return renderElement(this.tagName, this.attrs, this.innerHtml(component));
    }
}
