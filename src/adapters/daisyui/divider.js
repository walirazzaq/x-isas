const COLOR_CLASSES = Object.freeze({
    neutral: 'divider-neutral',
    primary: 'divider-primary',
    secondary: 'divider-secondary',
    accent: 'divider-accent',
    success: 'divider-success',
    warning: 'divider-warning',
    info: 'divider-info',
    error: 'divider-error',
});

const DIRECTION_CLASSES = Object.freeze({
    vertical: 'divider-vertical',
    horizontal: 'divider-horizontal',
});

const PLACEMENT_CLASSES = Object.freeze({
    start: 'divider-start',
    end: 'divider-end',
});

export function dividerAdapter({ attrs }) {
    const direction = attrs.get('direction', 'vertical');
    const color = COLOR_CLASSES[attrs.get('color')] ?? '';
    const directionClass = DIRECTION_CLASSES[direction] ?? DIRECTION_CLASSES.vertical;
    const placement = PLACEMENT_CLASSES[attrs.get('placement')] ?? '';
    const adaptiveMargin = attrs.boolean('adaptive')
        ? (direction === 'horizontal' ? '--divider-m:0 0.5em' : '--divider-m:0.5em 0')
        : null;

    return {
        host: {
            class: ['divider', color, directionClass, placement],
            style: adaptiveMargin,
        },
    };
}
