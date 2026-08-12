import { SLOT_CONTEXT_ATTRIBUTE } from '../../support/slot-bag.js';
import { resolveItemView } from '../../components/menu/menu.js';

const SIZE_CLASSES = Object.freeze({
    xs: 'menu-xs',
    sm: 'menu-sm',
    md: 'menu-md',
    lg: 'menu-lg',
    xl: 'menu-xl',
});

function itemAttributes({ attrs, slots }) {
    const view = resolveItemView(attrs, slots);

    return {
        host: {
            class: [
                'menu-item',
                view.mode === 'heading' ? 'menu-title' : '',
                view.disabled ? 'menu-disabled' : '',
            ],
        },
        parts: {
            content: {
                class: [
                    'flex w-full items-center gap-2',
                    attrs.boolean('active') && view.mode !== 'heading' ? 'menu-active' : '',
                ],
            },
            label: { class: 'min-w-0 grow text-start' },
            prepend: { class: 'inline-flex shrink-0 items-center gap-2' },
            append: { class: 'ml-auto inline-flex shrink-0 items-center gap-2' },
            icon: { class: 'shrink-0' },
            'icon-end': { class: 'shrink-0' },
        },
    };
}

export function menuAdapter({ attrs }) {
    const submenu = attrs.get(SLOT_CONTEXT_ATTRIBUTE) === 'submenu';
    const size = submenu ? '' : SIZE_CLASSES[attrs.get('size')] ?? '';
    const variant = String(attrs.get('variant') ?? 'vertical').toLowerCase();

    return {
        host: {
            class: [
                submenu ? '' : 'menu',
                size,
                !submenu && variant === 'horizontal' ? 'menu-horizontal' : '',
            ],
        },
        parts: {
            item: itemAttributes,
        },
    };
}
