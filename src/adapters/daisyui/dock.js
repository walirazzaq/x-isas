import { resolveDockItemView } from '../../components/dock/dock.js';

const SIZE_CLASSES = Object.freeze({
    xs: 'dock-xs',
    sm: 'dock-sm',
    md: 'dock-md',
    lg: 'dock-lg',
    xl: 'dock-xl',
});

function itemAttributes({ attrs, slots }) {
    const view = resolveDockItemView(attrs, slots);

    return {
        host: {
            class: attrs.boolean('active') ? 'dock-active' : '',
        },
        parts: view.composed
            ? { label: { class: 'dock-label' } }
            : {},
    };
}

export function dockAdapter({ attrs }) {
    return {
        host: {
            class: [
                'dock',
                SIZE_CLASSES[attrs.get('size')] ?? '',
            ],
        },
        parts: {
            item: itemAttributes,
        },
    };
}
