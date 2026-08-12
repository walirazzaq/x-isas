const COLOR_CLASSES = Object.freeze({
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error',
});

const VARIANT_CLASSES = Object.freeze({
    soft: 'alert-soft',
    outline: 'alert-outline',
    dash: 'alert-dash',
});

const DIRECTION_CLASSES = Object.freeze({
    vertical: 'alert-vertical',
    horizontal: 'alert-horizontal',
});

export function alertAdapter({ attrs }) {
    return {
        host: {
            class: [
                'alert',
                COLOR_CLASSES[attrs.get('color')] ?? '',
                VARIANT_CLASSES[attrs.get('variant')] ?? '',
                DIRECTION_CLASSES[attrs.get('direction')] ?? '',
            ],
        },
        parts: {
            prepend: { class: 'inline-flex shrink-0 items-center gap-2' },
            content: { class: 'min-w-0' },
            heading: { class: 'font-bold' },
            description: { class: 'text-xs' },
            append: { class: 'inline-flex shrink-0 flex-wrap items-center gap-2' },
            icon: { class: 'shrink-0' },
            'icon-end': { class: 'shrink-0' },
        },
    };
}
