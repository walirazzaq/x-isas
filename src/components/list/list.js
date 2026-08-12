import { Component } from '../../component.js';
import {
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNode,
} from '../../support/html.js';
import {
    prepareItemAppend,
    prepareItemPrepend,
} from '../../support/item-accessories.js';

const SIZE_NAMES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
const COMPOSED_ATTRIBUTES = new Set([
    'avatar',
    'icon',
    'badge',
    'icon-end',
    'badge-end',
    'heading',
    'subheading',
    'description',
]);
const COMPOSED_NAMESPACES = [
    'prepend:',
    'main:',
    'heading:',
    'subheading:',
    'description:',
    'append:',
    'avatar:',
    'icon:',
    'badge:',
    'icon-end:',
    'badge-end:',
];
const COMPOSED_SLOTS = [
    'prepend',
    'heading',
    'subheading',
    'description',
    'append',
];
const FALSE_AVATAR_VALUES = new Set(['false', '0', 'null', 'off', 'no']);
const TRUE_AVATAR_VALUES = new Set(['', 'true', '1']);

function composedItem(attrs, slots) {
    if (attrs.entries().some(([name]) => (
        COMPOSED_ATTRIBUTES.has(name)
        || COMPOSED_NAMESPACES.some((prefix) => name.startsWith(prefix))
    ))) {
        return true;
    }

    return COMPOSED_SLOTS.some((name) => slots.has(name));
}

export function resolveListItemSize(attrs, parentAttrs = null) {
    const value = String(attrs.get('size', parentAttrs?.get('size', 'md') ?? 'md'));
    return SIZE_NAMES.has(value) ? value : 'md';
}

export function resolveListItemView(attrs, slots, parentAttrs = null) {
    return {
        composed: composedItem(attrs, slots),
        size: resolveListItemSize(attrs, parentAttrs),
    };
}

function avatarAttributes(attrs, size) {
    if (!attrs.has('avatar')) return null;

    const raw = attrs.get('avatar');
    if (raw === false || raw === null || raw === undefined) return null;

    const value = String(raw).trim();
    if (FALSE_AVATAR_VALUES.has(value.toLowerCase())) return null;

    const defaults = {
        size,
        class: 'shrink-0',
        'content:class': 'rounded-full',
    };

    if (!TRUE_AVATAR_VALUES.has(value.toLowerCase())) defaults.src = value;
    return attrs.for('avatar').merge(defaults);
}

function resolvedContent(attrs, slots, name) {
    if (slots.has(name)) return slots.get(name).html();
    if (!attrs.has(name)) return '';

    const value = attrs.get(name);
    if (value === true || value === false || value === null || value === undefined) return '';
    return safeSlotText(String(value));
}

function prepareItem({ component, attrs, slots }) {
    const view = resolveListItemView(attrs, slots, component.attrs);
    if (!view.composed) return view;

    prepareItemPrepend(attrs, slots, {
        keyPrefix: 'list:item',
        avatarAttributes: avatarAttributes(attrs, view.size),
    });
    prepareItemAppend(attrs, slots, { keyPrefix: 'list:item' });

    return view;
}

function renderComposedItem({ attrs, slots }) {
    const heading = slots.has('heading')
        ? slots.get('heading').html()
        : attrs.has('heading')
            ? resolvedContent(attrs, slots, 'heading')
            : slots.get('default').html();
    const subheading = resolvedContent(attrs, slots, 'subheading');
    const description = resolvedContent(attrs, slots, 'description');
    const prepend = slots.has('prepend')
        ? renderElement('div', attrs.for('prepend'), slots.get('prepend').html())
        : '';
    const append = slots.has('append')
        ? renderElement('div', attrs.for('append'), slots.get('append').html())
        : '';
    const main = renderElement(
        'div',
        attrs.for('main'),
        `${renderElement('div', attrs.for('heading'), heading)}${
            subheading ? renderElement('div', attrs.for('subheading'), subheading) : ''
        }`,
    );
    const wrappedDescription = description
        ? renderElement('div', attrs.for('description'), description)
        : '';

    return `${prepend}${main}${wrappedDescription}${append}`;
}

function renderItem(context) {
    if (!context.view.composed) return context.renderDefault();
    return renderComposedItem(context);
}

const itemPart = Object.freeze({
    tag: 'li',
    prepare: prepareItem,
    render: renderItem,
});

/** A list host that owns shallow rows while preserving unmarked children. */
export class List extends Component {
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
