const COLOR_CLASSES = Object.freeze({
    neutral: 'tooltip-neutral',
    primary: 'tooltip-primary',
    secondary: 'tooltip-secondary',
    accent: 'tooltip-accent',
    success: 'tooltip-success',
    warning: 'tooltip-warning',
    error: 'tooltip-error',
    info: 'tooltip-info',
});

const PLACEMENT_CLASSES = Object.freeze({
    top: 'tooltip-top',
    right: 'tooltip-right',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
});

const ALIGNMENT_CLASSES = Object.freeze({
    start: 'tooltip-start',
    center: 'tooltip-center',
    end: 'tooltip-end',
});

export function tooltipAdapter({ attrs }) {
    const color = COLOR_CLASSES[attrs.get('color')] ?? '';
    const side = String(attrs.get('placement', 'top')).split('-', 1)[0];
    const placement = PLACEMENT_CLASSES[side] ?? PLACEMENT_CLASSES.top;
    const align = ALIGNMENT_CLASSES[attrs.get('align')] ?? ALIGNMENT_CLASSES.center;
    const open = attrs.has('open') ? 'tooltip-open' : '';

    return {
        host: {
            class: ['tooltip', placement, align, open, color],
        },
        parts: {
            content: { class: 'tooltip-content' },
        },
    };
}
