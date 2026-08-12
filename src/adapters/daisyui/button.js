import { variantAdapter } from './support.js';

const COLOR_CLASSES = Object.freeze({
    neutral: 'btn-neutral',
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error',
    info: 'btn-info',
});

const SIZE_CLASSES = Object.freeze({
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
    xl: 'btn-xl',
});

const VARIANT_CLASSES = Object.freeze({
    outline: 'btn-outline',
    dash: 'btn-dash',
    soft: 'btn-soft',
    ghost: 'btn-ghost',
    link: 'btn-link',
});

export function buttonAdapter({ attrs, slots }) {
    return variantAdapter({
        attrs,
        slots,
        base: 'btn',
        colors: COLOR_CLASSES,
        sizes: SIZE_CLASSES,
        variants: VARIANT_CLASSES,
        accessories: true,
    });
}
