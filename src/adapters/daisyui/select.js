const SIZE_CLASSES = Object.freeze({
    xs: 'input-xs',
    sm: 'input-sm',
    md: 'input-md',
    lg: 'input-lg',
    xl: 'input-xl',
});

const COLOR_CLASSES = Object.freeze({
    neutral: 'input-neutral',
    primary: 'input-primary',
    secondary: 'input-secondary',
    accent: 'input-accent',
    success: 'input-success',
    warning: 'input-warning',
    error: 'input-error',
    info: 'input-info',
});

const VARIANT_CLASSES = Object.freeze({
    ghost: 'input-ghost',
});

export function selectAdapter(context = {}) {
    const { attrs, component } = context;
    if (!attrs) return {};
    const size = SIZE_CLASSES[attrs.get('size')] ?? '';
    const color = COLOR_CLASSES[attrs.get('color')] ?? '';
    const variant = VARIANT_CLASSES[attrs.get('variant')] ?? '';
    const uncappedMultiple = component?.isMultiple()
        && !attrs.has('max-selection-shown');
    const invalid = Boolean(component?.state?.validationVisible);

    return {
        host: {
            class: 'relative inline-block min-w-0 w-full max-w-full',
        },
        parts: {
            trigger: {
                class: [
                    'input flex min-w-0 w-full max-w-full items-center gap-2 text-left',
                    'cursor-pointer disabled:pointer-events-none disabled:opacity-60',
                    uncappedMultiple ? 'h-auto min-h-10 py-2' : '',
                    invalid ? 'input-error' : '',
                    size,
                    color,
                    variant,
                ],
            },
            prepend: { class: 'inline-flex shrink-0 items-center opacity-70' },
            append: { class: 'ml-auto inline-flex shrink-0 items-center gap-1 opacity-70' },
            suffix: { class: 'truncate' },
            chevron: { class: 'i-tabler-chevron-down shrink-0' },
            selection: {
                class: [
                    'min-w-0 basis-0 grow',
                    uncappedMultiple ? 'overflow-visible' : 'overflow-hidden',
                ],
            },
            'selection-items': {
                class: [
                    'flex w-full min-w-0 items-center gap-1',
                    uncappedMultiple
                        ? 'flex-wrap whitespace-normal'
                        : 'overflow-hidden whitespace-nowrap',
                ],
            },
            'selection-item': {
                class: 'inline-flex min-w-0 shrink items-center gap-1 overflow-hidden',
            },
            'single-selection': { class: 'max-w-full truncate' },
            chip: { class: 'badge badge-sm badge-neutral badge-soft min-w-0 max-w-full' },
            more: { class: 'badge badge-sm badge-neutral badge-ghost shrink-0' },
            placeholder: { class: 'block truncate text-base-content/45' },
            panel: {
                class: [
                    'w-full overflow-hidden',
                    'border border-base-300 bg-base-100 p-0 shadow-xl',
                ],
            },
            '_dialog-header': {
                class: 'flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3',
            },
            '_dialog-title': { class: 'min-w-0 truncate text-base font-semibold' },
            '_dialog-close': {
                class: 'btn btn-ghost btn-circle btn-sm shrink-0',
            },
            '_dialog-close-icon': { class: 'i-tabler-x' },
            'search-wrapper': { class: 'border-b border-base-300 p-2' },
            search: { class: 'w-full' },
            listbox: {
                class: 'max-h-72 overflow-y-auto p-2 outline-none',
            },
            empty: {
                class: 'px-3 py-6 text-center text-sm text-base-content/50',
            },
            error: {
                class: 'mt-1 px-1 text-sm text-error',
            },
            '_dialog-footer': {
                class: 'flex justify-end border-t border-base-300 px-4 py-3',
            },
            _done: { class: 'btn btn-primary btn-sm' },
        },
    };
}
