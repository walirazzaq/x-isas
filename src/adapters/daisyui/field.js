const SIZE_CLASSES = Object.freeze({
    xs: {
        rowGap: 'gap-y-1',
        columnGap: 'gap-x-2',
        accessoryGap: 'gap-1',
        label: 'text-xs',
        metadata: 'text-xs',
    },
    sm: {
        rowGap: 'gap-y-1',
        columnGap: 'gap-x-3',
        accessoryGap: 'gap-1.5',
        label: 'text-sm',
        metadata: 'text-xs',
    },
    md: {
        rowGap: 'gap-y-1.5',
        columnGap: 'gap-x-4',
        accessoryGap: 'gap-2',
        label: 'text-base',
        metadata: 'text-sm',
    },
    lg: {
        rowGap: 'gap-y-2',
        columnGap: 'gap-x-5',
        accessoryGap: 'gap-2.5',
        label: 'text-lg',
        metadata: 'text-base',
    },
    xl: {
        rowGap: 'gap-y-3',
        columnGap: 'gap-x-6',
        accessoryGap: 'gap-3',
        label: 'text-xl',
        metadata: 'text-lg',
    },
});

export function fieldAdapter({ component, attrs }, controlName) {
    const layout = component.layout(attrs);
    const sizeName = component.size(attrs);
    const size = SIZE_CLASSES[sizeName] ?? SIZE_CLASSES.md;
    const split = layout === 'inline';
    const position = (inline) => (split ? inline : '');

    return {
        host: {
            class: layout === 'stacked'
                ? ['flex min-w-0 flex-col', size.rowGap]
                : [
                    'grid min-w-0 grid-cols-1',
                    size.columnGap,
                    size.rowGap,
                    'grid-cols-2',
                ],
            'data-layout': layout,
            'data-size': sizeName,
        },
        parts: {
            label: {
                host: {
                    class: [
                        'flex min-w-0 items-center font-medium leading-snug',
                        size.accessoryGap,
                        size.label,
                        position('col-start-1 row-start-1'),
                    ],
                },
                slots: {
                    prepend: { class: 'inline-flex shrink-0 items-center' },
                    content: { class: 'min-w-0 grow' },
                    append: { class: 'ml-auto inline-flex shrink-0 items-center' },
                },
            },
            control: {
                host: {
                    class: ['min-w-0', position('col-start-2 row-start-1')],
                },
            },
            support: {
                host: {
                    class: [
                        'flex min-w-0 items-start leading-snug text-base-content/65',
                        size.accessoryGap,
                        size.metadata,
                        position('col-start-1 row-start-2'),
                    ],
                },
                slots: {
                    prepend: { class: 'inline-flex shrink-0 items-center' },
                    content: { class: 'min-w-0 grow' },
                    append: { class: 'ml-auto inline-flex shrink-0 items-center' },
                },
            },
            error: {
                host: {
                    class: [
                        'min-w-0 leading-snug text-error',
                        size.metadata,
                        position('col-start-2 row-start-2'),
                    ],
                },
            },
            [controlName]: { class: 'w-full' },
        },
    };
}
