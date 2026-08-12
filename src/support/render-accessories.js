import { renderElement } from './html.js';

const ACCESSORIES = Object.freeze({
    icon: 'prepend',
    'icon-end': 'append',
});

export function prepareAccessories(attrs, slots) {
    Object.entries(ACCESSORIES).forEach(([attribute, slot]) => {
        const icon = attrs.get(attribute);

        if (icon && !slots.has(slot)) {
            const iconAttributes = attrs.for(attribute).merge({ class: icon });
            slots.set(slot, renderElement('span', iconAttributes));
        }
    });

    return slots;
}

export function renderAccessories(attrs, slots) {
    const prepend = slots.has('prepend')
        ? renderElement('span', attrs.for('prepend'), slots.get('prepend').html())
        : '';
    const append = slots.has('append')
        ? renderElement('span', attrs.for('append'), slots.get('append').html())
        : '';

    return `${prepend}${slots.get('default').html()}${append}`;
}
