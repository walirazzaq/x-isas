import { Component } from '../../component.js';
import {
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNode,
} from '../../support/html.js';

const COMPOSED_ATTRIBUTES = new Set(['icon', 'label']);
const COMPOSED_NAMESPACES = ['icon:', 'label:'];
const COMPOSED_SLOTS = ['icon', 'label'];

function composedItem(attrs, slots) {
    if (COMPOSED_SLOTS.some((name) => slots.has(name))) return true;

    return attrs.entries().some(([name]) => (
        COMPOSED_ATTRIBUTES.has(name)
        || COMPOSED_NAMESPACES.some((prefix) => name.startsWith(prefix))
    ));
}

function hasLabelAttribute(attrs) {
    if (!attrs.has('label')) return false;
    return ![false, null, undefined].includes(attrs.get('label'));
}

export function resolveDockItemView(attrs, slots) {
    const icon = attrs.get('icon');

    return {
        composed: composedItem(attrs, slots),
        hasIcon: slots.has('icon') || Boolean(icon),
        hasLabel: slots.has('label')
            || hasVisibleContent(slots.get('default'))
            || hasLabelAttribute(attrs),
        icon: icon ? String(icon) : '',
    };
}

function prepareItem({ attrs, slots }) {
    const view = resolveDockItemView(attrs, slots);
    if (!view.composed || slots.has('label') || hasVisibleContent(slots.get('default'))) {
        return view;
    }

    if (hasLabelAttribute(attrs)) {
        slots.set('default', safeSlotText(String(attrs.get('label'))));
    }

    return view;
}

function renderItem({ attrs, slots, view, renderDefault }) {
    if (!view.composed) return renderDefault();

    const iconAttributes = view.icon && !slots.has('icon')
        ? attrs.for('icon').merge({ class: view.icon })
        : attrs.for('icon');
    const icon = view.hasIcon
        ? renderElement(
            'span',
            iconAttributes,
            slots.has('icon') ? slots.get('icon').html() : '',
        )
        : '';
    const labelContent = slots.has('label')
        ? slots.get('label').html()
        : slots.get('default').html();
    const label = view.hasLabel
        ? renderElement('span', attrs.for('label'), labelContent)
        : '';

    return `${icon}${label}`;
}

const itemPart = Object.freeze({
    prepare: prepareItem,
    render: renderItem,
});

/** A Dock host that owns shallow, tag-agnostic item parts. */
export class Dock extends Component {
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
