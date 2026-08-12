import { generatedComponentAttributes } from './generated-component.js';
import { renderElement, safeSlotText } from './html.js';

export function prepareItemPrepend(
    attrs,
    slots,
    { keyPrefix, avatarAttributes = null } = {},
) {
    if (slots.has('prepend')) return;

    const pieces = [];
    const icon = attrs.get('icon');

    if (avatarAttributes) {
        pieces.push(renderElement(
            'span',
            avatarAttributes.merge({
                'x-is': 'avatar',
                ...generatedComponentAttributes(`${keyPrefix}:avatar`),
            }),
        ));
    }

    if (icon) {
        pieces.push(renderElement('span', attrs.for('icon').merge({ class: icon })));
    }

    if (attrs.has('badge')) {
        pieces.push(renderElement(
            'span',
            attrs.for('badge').merge({
                'x-is': 'badge',
                size: 'sm',
                ...generatedComponentAttributes(`${keyPrefix}:badge`),
            }),
            safeSlotText(attrs.get('badge')),
        ));
    }

    if (pieces.length) slots.set('prepend', pieces.join(''));
}

export function prepareItemAppend(attrs, slots, { keyPrefix } = {}) {
    if (slots.has('append')) return;

    const pieces = [];
    const icon = attrs.get('icon-end');

    if (icon) {
        pieces.push(renderElement('span', attrs.for('icon-end').merge({ class: icon })));
    }

    if (attrs.has('badge-end')) {
        pieces.push(renderElement(
            'span',
            attrs.for('badge-end').merge({
                'x-is': 'badge',
                size: 'sm',
                ...generatedComponentAttributes(`${keyPrefix}:badge-end`),
            }),
            safeSlotText(attrs.get('badge-end')),
        ));
    }

    if (pieces.length) slots.set('append', pieces.join(''));
}
