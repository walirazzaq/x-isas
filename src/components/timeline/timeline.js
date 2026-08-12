import { Component } from '../../component.js';
import {
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNode,
} from '../../support/html.js';

const COMPOSED_ATTRIBUTES = new Set([
    'start',
    'middle',
    'end',
    'icon',
    'box',
    'connector',
]);
const COMPOSED_NAMESPACES = [
    'before:',
    'start:',
    'middle:',
    'icon:',
    'end:',
    'after:',
];
const COMPOSED_SLOTS = ['start', 'middle', 'end'];
const CONNECTOR_MODES = new Set(['auto', 'before', 'after', 'both', 'none']);

function composedItem(attrs, slots) {
    if (COMPOSED_SLOTS.some((name) => slots.has(name))) return true;

    return attrs.entries().some(([name]) => (
        COMPOSED_ATTRIBUTES.has(name)
        || COMPOSED_NAMESPACES.some((prefix) => name.startsWith(prefix))
    ));
}

function attributeContent(attrs, name) {
    if (!attrs.has(name)) return '';

    const value = attrs.get(name);
    if (value === true || value === false || value === null || value === undefined) return '';
    return safeSlotText(String(value));
}

function connectorView(attrs, index, total) {
    const requested = String(attrs.get('connector', 'auto')).toLowerCase();
    const mode = CONNECTOR_MODES.has(requested) ? requested : 'auto';

    if (mode === 'before') return { mode, before: true, after: false };
    if (mode === 'after') return { mode, before: false, after: true };
    if (mode === 'both') return { mode, before: true, after: true };
    if (mode === 'none') return { mode, before: false, after: false };

    return {
        mode,
        before: index > 0,
        after: index < total - 1,
    };
}

export function resolveTimelineItemView(attrs, slots) {
    return {
        composed: composedItem(attrs, slots),
        box: String(attrs.get('box') ?? '').toLowerCase(),
    };
}

function prepareItem({ component, part, attrs, slots, index }) {
    if (part.tagName !== 'li') {
        throw new Error("Component 'timeline' requires x-part='item' to use a <li> element.");
    }

    const view = resolveTimelineItemView(attrs, slots);
    if (!view.composed) return view;

    if (!slots.has('start')) {
        slots.set('start', attributeContent(attrs, 'start'));
    }

    if (!slots.has('middle')) {
        if (attrs.has('middle')) {
            slots.set('middle', attributeContent(attrs, 'middle'));
        } else {
            const icon = attrs.get('icon');
            if (icon) {
                slots.set('middle', renderElement(
                    'span',
                    attrs.for('icon').merge({ class: String(icon) }),
                ));
            }
        }
    }

    if (!slots.has('end')) {
        if (attrs.has('end')) {
            slots.set('end', attributeContent(attrs, 'end'));
        } else if (hasVisibleContent(slots.get('default'))) {
            slots.set('end', slots.get('default'));
        }
    }

    return {
        ...view,
        ...connectorView(attrs, index, component.parts.all('item').length),
    };
}

function itemKey(attrs, index) {
    return String(attrs.get('wire:key', attrs.get('id', `item:${index}`)));
}

function region(attrs, slots, name, key) {
    if (!slots.has(name)) return '';
    return renderElement(
        'div',
        attrs.for(name).merge({ 'data-isas-key': `timeline:${key}:${name}` }),
        slots.get(name).html(),
    );
}

function renderItem({ attrs, slots, view, index, renderDefault }) {
    if (!view.composed) return renderDefault();

    const key = itemKey(attrs, index);
    const before = view.before
        ? renderElement(
            'hr',
            attrs.for('before').merge({ 'data-isas-key': `timeline:${key}:before` }),
            null,
        )
        : '';
    const after = view.after
        ? renderElement(
            'hr',
            attrs.for('after').merge({ 'data-isas-key': `timeline:${key}:after` }),
            null,
        )
        : '';

    return `${before}${region(attrs, slots, 'start', key)}${
        region(attrs, slots, 'middle', key)}${region(attrs, slots, 'end', key)}${after}`;
}

const itemPart = Object.freeze({
    tag: 'li',
    prepare: prepareItem,
    render: renderItem,
});

/** A Timeline host that owns shallow items and their generated regions. */
export class Timeline extends Component {
    static structural = true;

    static parts = {
        item: itemPart,
    };

    render() {
        const parts = new Map(this.parts.ordered().map((part) => [part.position, part]));

        return this.source.childNodes().map((node, position) => (
            parts.has(position) ? parts.get(position).html(this) : serializeNode(node)
        )).join('');
    }
}
