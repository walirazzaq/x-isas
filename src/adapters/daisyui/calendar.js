import { resolveInputStyleClasses } from './input-styles.js';

function calendarParts() {
    return {
        content: { class: 'rounded-box border border-base-300 bg-base-100 p-3 shadow-sm' },
        header: { class: 'mb-2 flex items-center justify-between gap-2' },
        previous: { class: 'btn btn-ghost btn-sm btn-square text-lg' },
        next: { class: 'btn btn-ghost btn-sm btn-square text-lg' },
        'view-trigger': { class: 'btn btn-ghost btn-sm min-w-36 font-semibold' },
        months: { class: 'flex max-w-full flex-wrap gap-4' },
        month: { class: 'min-w-0' },
        'month-label': { class: 'sr-only' },
        table: { class: 'w-full table-fixed border-separate border-spacing-0.5' },
        weekday: { class: 'h-8 text-center text-xs font-normal text-base-content/55' },
        'week-number': { class: 'h-9 w-8 text-center text-xs font-normal text-base-content/40' },
        day: {
            class: [
                'btn btn-ghost btn-sm h-9 min-h-9 w-9 p-0 font-normal',
                'data-[outside-range]:opacity-30 data-[today]:ring-1 data-[today]:ring-primary',
                'data-[selected]:bg-primary data-[selected]:text-primary-content',
                'data-[in-range]:rounded-none data-[in-range]:bg-primary/15',
                'data-[range-start]:rounded-s-field data-[range-end]:rounded-e-field',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-25',
            ],
        },
        'month-option': { class: 'btn btn-ghost btn-sm w-full data-[selected]:btn-primary' },
        'year-option': { class: 'btn btn-ghost btn-sm w-full data-[selected]:btn-primary' },
        error: { class: 'mt-1 px-1 text-sm text-error' },
        native: { class: 'sr-only' },
        panel: {
            class: [
                'w-full max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto',
                'max-h-[calc(100vh-1rem)] border border-base-300 bg-base-100 p-0 shadow-xl',
            ],
        },
        presets: { class: 'flex flex-wrap gap-2 border-b border-base-300 p-3' },
        'dialog-header': { class: 'flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3' },
        'dialog-title': { class: 'font-semibold' },
        'dialog-close': { class: 'btn btn-ghost btn-circle btn-sm' },
    };
}

export function calendarAdapter({ component }) {
    const fill = component?.layout?.() === 'fill';
    return {
        host: { class: fill ? 'block w-full max-w-full' : 'inline-block max-w-full' },
        parts: calendarParts(),
    };
}

export function datePickerAdapter({ attrs, component }) {
    const invalid = Boolean(component?.state?.validationVisible);
    const { color, size, variant } = resolveInputStyleClasses(attrs, { invalid });
    return {
        host: { class: 'block max-w-full align-top' },
        parts: {
            ...calendarParts(),
            'trigger-shell': {
                class: ['input group w-full', size, color, variant],
            },
            trigger: {
                class: [
                    'flex h-full min-w-0 grow cursor-pointer items-center border-0 bg-transparent p-0 text-left',
                    'font-[inherit] text-[inherit] text-base-content outline-none',
                    'disabled:cursor-not-allowed disabled:text-base-content/40',
                ],
            },
            value: { class: 'min-w-0 grow truncate' },
            placeholder: { class: 'min-w-0 grow truncate text-base-content/45' },
            prepend: { class: 'inline-flex shrink-0 items-center' },
            append: { class: 'inline-flex shrink-0 items-center' },
            'trigger-icon': { class: 'i-tabler-calendar shrink-0 opacity-70' },
            'clear-action': {
                class: [
                    'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center p-0',
                    'opacity-50 transition-opacity hover:opacity-100',
                    'disabled:cursor-not-allowed disabled:opacity-25',
                ],
            },
            'clear-icon': { class: 'i-tabler-x' },
        },
    };
}
