export function optionAdapter(context = {}) {
    if (!context.attrs && !context.slots) return {};
    return {
        host: {
            class: [
                'flex w-full items-center gap-3 rounded-field px-3 py-2 text-left',
                'group cursor-pointer select-none outline-none transition-colors',
                'hover:bg-base-200 focus-visible:bg-base-200',
                'data-[selected]:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            ],
        },
        parts: {
            prepend: { class: 'inline-flex shrink-0 items-center gap-2' },
            avatar: { class: 'shrink-0' },
            icon: { class: 'shrink-0 text-base-content/65' },
            body: { class: 'min-w-0 grow' },
            label: { class: 'block truncate' },
            description: { class: 'block truncate text-xs text-base-content/55' },
            append: { class: 'ml-auto inline-flex shrink-0 items-center gap-2' },
            indicator: {
                class: 'ml-auto inline-flex size-5 shrink-0 items-center justify-center',
            },
            'indicator-icon': {
                class: 'opacity-0 transition-opacity group-data-[selected]:opacity-100',
            },
            'selection-fallback': {
                class: 'inline-flex min-w-0 items-center gap-1.5 overflow-hidden',
            },
            'selection-label': { class: 'truncate' },
            'selection-icon': { class: 'shrink-0' },
        },
    };
}
