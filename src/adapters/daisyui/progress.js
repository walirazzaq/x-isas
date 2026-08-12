const COLOR_CLASSES = Object.freeze({
    neutral: 'progress-neutral',
    primary: 'progress-primary',
    secondary: 'progress-secondary',
    accent: 'progress-accent',
    success: 'progress-success',
    warning: 'progress-warning',
    error: 'progress-error',
    info: 'progress-info',
});

const SIZE_CLASSES = Object.freeze({
    xs: {
        bar: 'h-1',
        label: 'text-sm',
        meta: 'text-xs',
        gap: 'gap-1',
    },
    sm: {
        bar: 'h-2',
        label: 'text-base',
        meta: 'text-sm',
        gap: 'gap-1',
    },
    md: {
        bar: 'h-3',
        label: 'text-lg',
        meta: 'text-base',
        gap: 'gap-2',
    },
    lg: {
        bar: 'h-4',
        label: 'text-xl',
        meta: 'text-lg',
        gap: 'gap-2',
    },
    xl: {
        bar: 'h-5',
        label: 'text-2xl',
        meta: 'text-xl',
        gap: 'gap-3',
    },
});

export function progressAdapter({ component, attrs }) {
    const size = SIZE_CLASSES[attrs.get('size')] ?? SIZE_CLASSES.md;
    const color = COLOR_CLASSES[attrs.get('color')] ?? '';
    const barClasses = ['progress', color, size.bar];

    if (component.el.localName === 'progress') {
        return {
            host: {
                class: barClasses,
            },
        };
    }

    return {
        host: {
            class: ['flex flex-col', size.gap],
        },
        parts: {
            bar: {
                host: {
                    class: barClasses,
                },
            },
            'label-row': {
                class: 'flex items-center justify-between gap-2 leading-tight',
            },
            label: {
                class: `${size.label} font-medium`,
            },
            'label-end': {
                class: `${size.meta} text-base-content/70`,
            },
            description: {
                class: `${size.meta} leading-tight text-base-content/70`,
            },
        },
    };
}
