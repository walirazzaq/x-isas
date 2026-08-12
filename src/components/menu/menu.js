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

const BOOLEAN_HEADING_VALUES = new Set(['', 'true', '1']);
const LINK_ATTRIBUTES = ['href', 'target', 'rel', 'download'];

function headingFallback(attrs) {
    if (!attrs.boolean('heading')) return '';

    const value = String(attrs.get('heading') ?? '');
    return BOOLEAN_HEADING_VALUES.has(value.toLowerCase()) ? '' : value;
}

function resolvedHref(attrs) {
    const content = attrs.for('content');
    if (content.has('href')) return { present: true, value: content.get('href') };
    if (attrs.has('href')) return { present: true, value: attrs.get('href') };
    return { present: false, value: null };
}

export function resolveItemView(attrs, slots) {
    const heading = attrs.boolean('heading');
    const hasSubmenu = slots.has('submenu');
    const collapsible = attrs.boolean('collapsible') && hasSubmenu;
    const href = resolvedHref(attrs);
    const mode = collapsible
        ? 'disclosure'
        : heading
            ? 'heading'
            : href.present
                ? 'link'
                : 'button';

    return {
        mode,
        contentTag: {
            disclosure: 'summary',
            heading: 'h2',
            link: 'a',
            button: 'button',
        }[mode],
        hasSubmenu,
        collapsible,
        heading,
        disabled: attrs.boolean('disabled'),
        href,
    };
}

function preparePrepend(attrs, slots) {
    const avatar = attrs.get('avatar');
    const avatarAttributes = avatar !== null
        && avatar !== undefined
        && String(avatar) !== ''
        ? attrs.for('avatar').merge({
            src: String(avatar),
            size: 'adaptive',
            class: 'shrink-0',
            'content:class': 'rounded-full',
        })
        : null;

    prepareItemPrepend(attrs, slots, {
        keyPrefix: 'menu:item',
        avatarAttributes,
    });
}

function prepareAppend(attrs, slots) {
    prepareItemAppend(attrs, slots, { keyPrefix: 'menu:item' });
}

function prepareItem({ attrs, slots }) {
    const view = resolveItemView(attrs, slots);
    let contentSource = 'authored';

    if (!hasVisibleContent(slots.get('default'))) {
        const heading = headingFallback(attrs);
        const label = attrs.has('label') ? String(attrs.get('label') ?? '') : '';
        const fallback = heading || label;

        contentSource = heading ? 'heading' : label ? 'label' : 'empty';
        slots.set('default', safeSlotText(fallback));
    }

    preparePrepend(attrs, slots);
    prepareAppend(attrs, slots);

    if (view.hasSubmenu) {
        slots.set('submenu', slots.get('submenu').attrs(attrs.for('submenu')));
    }

    return { ...view, contentSource };
}

function contentAttributes(attrs, view) {
    const { mode, disabled, href } = view;
    let attributes = attrs.for('content');

    if (mode === 'link') {
        attributes = attributes.merge(Object.fromEntries(
            LINK_ATTRIBUTES
                .filter((name) => attrs.has(name))
                .map((name) => [name, attrs.get(name)]),
        ));

        if (disabled) {
            attributes = attributes
                .remove('href')
                .set('role', attributes.get('role', 'link'))
                .set('aria-disabled', 'true')
                .set('tabindex', '-1');
        } else if (!attributes.has('href') && href.present) {
            attributes = attributes.set('href', href.value);
        }

        return attributes.remove('type', 'disabled');
    }

    attributes = attributes.remove(...LINK_ATTRIBUTES);

    if (mode === 'button') {
        return attributes.merge({
            type: attrs.get('type', 'button'),
            disabled,
        });
    }

    attributes = attributes.remove('type', 'disabled');

    if (mode === 'disclosure' && disabled) {
        attributes = attributes
            .set('aria-disabled', 'true')
            .set('tabindex', '-1');
    }

    return attributes;
}

function renderContent(attrs, slots, view) {
    const prepend = slots.has('prepend')
        ? renderElement('span', attrs.for('prepend'), slots.get('prepend').html())
        : '';
    const append = slots.has('append')
        ? renderElement('span', attrs.for('append'), slots.get('append').html())
        : '';
    const label = renderElement('span', attrs.for('label'), slots.get('default').html());

    return renderElement(
        view.contentTag,
        contentAttributes(attrs, view),
        `${prepend}${label}${append}`,
    );
}

function renderItem({ attrs, slots, view }) {
    const content = renderContent(attrs, slots, view);
    const submenu = view.hasSubmenu ? slots.get('submenu').html() : '';

    if (!view.collapsible) return `${content}${submenu}`;

    const details = attrs.for('details').merge({
        open: attrs.boolean('open'),
    });

    return renderElement('details', details, `${content}${submenu}`);
}

const itemPart = Object.freeze({
    tag: 'li',
    prepare: prepareItem,
    render: renderItem,
});

/** A menu host that owns shallow item parts while preserving all other children. */
export class Menu extends Component {
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
