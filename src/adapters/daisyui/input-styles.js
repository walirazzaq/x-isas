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

export function resolveInputStyleClasses(attrs, { invalid = false } = {}) {
    return {
        size: SIZE_CLASSES[attrs.get('size')] ?? '',
        color: invalid
            ? COLOR_CLASSES.error
            : (COLOR_CLASSES[attrs.get('color')] ?? ''),
        variant: VARIANT_CLASSES[attrs.get('variant')] ?? '',
    };
}
