import { variantAdapter } from './support.js';

const COLOR_CLASSES = Object.freeze({
    neutral: 'badge-neutral',
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
});

const SIZE_CLASSES = Object.freeze({
    xs: 'badge-xs',
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg',
    xl: 'badge-xl',
});

const VARIANT_CLASSES = Object.freeze({
    outline: 'badge-outline',
    dash: 'badge-dash',
    soft: 'badge-soft',
    ghost: 'badge-ghost',
    link: 'badge-link',
});

export function badgeAdapter({ attrs, slots }) {
    return variantAdapter({
        attrs,
        slots,
        base: 'badge',
        colors: COLOR_CLASSES,
        sizes: SIZE_CLASSES,
        variants: VARIANT_CLASSES,
        accessories: true,
    });
}
