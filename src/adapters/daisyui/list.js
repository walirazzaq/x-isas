import { resolveListItemView } from '../../components/list/list.js';

const SIZE_CLASSES = Object.freeze({
    xs: {
        row: 'text-xs',
        heading: 'text-xs',
        meta: 'text-xs',
        gap: 'gap-2',
    },
    sm: {
        row: 'text-sm',
        heading: 'text-sm',
        meta: 'text-xs',
        gap: 'gap-3',
    },
    md: {
        row: 'text-base',
        heading: 'text-base',
        meta: 'text-sm',
        gap: 'gap-4',
    },
    lg: {
        row: 'text-lg',
        heading: 'text-lg',
        meta: 'text-base',
        gap: 'gap-5',
    },
    xl: {
        row: 'text-xl',
        heading: 'text-xl',
        meta: 'text-lg',
        gap: 'gap-6',
    },
});

function itemAttributes(parentAttrs, { attrs, slots }) {
    const view = resolveListItemView(attrs, slots, parentAttrs);
    const size = SIZE_CLASSES[view.size] ?? SIZE_CLASSES.md;
    const host = {
        class: ['list-row', size.row, size.gap],
    };

    if (!view.composed) return { host };

    return {
        host,
        parts: {
            prepend: { class: 'inline-flex shrink-0 items-center gap-2' },
            main: { class: 'list-col-grow min-w-0 space-y-1' },
            heading: {
                class: `min-w-0 font-medium leading-tight ${size.heading}`,
            },
            subheading: {
                class: `min-w-0 leading-snug text-base-content/70 ${size.meta}`,
            },
            description: {
                class: `list-col-wrap min-w-0 whitespace-normal break-words leading-snug text-base-content/70 ${size.meta}`,
            },
            append: { class: 'inline-flex shrink-0 items-center gap-2' },
            icon: { class: 'shrink-0' },
            'icon-end': { class: 'shrink-0' },
        },
    };
}

export function listAdapter({ attrs }) {
    const sizeName = String(attrs.get('size', 'md'));
    const size = SIZE_CLASSES[sizeName] ?? SIZE_CLASSES.md;

    return {
        host: {
            class: ['list', size.row],
        },
        parts: {
            item: (context) => itemAttributes(attrs, context),
        },
    };
}
