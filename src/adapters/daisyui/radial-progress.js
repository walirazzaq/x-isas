import { resolveProgressState } from '../../support/progress.js';

const SEMANTIC_COLORS = new Set([
    'neutral',
    'primary',
    'secondary',
    'accent',
    'success',
    'warning',
    'error',
    'info',
]);

const SIZE_VALUES = Object.freeze({
    xs: '3rem',
    sm: '4rem',
    md: '5rem',
    lg: '6rem',
    xl: '7rem',
});

const THICKNESS_VALUES = Object.freeze({
    xs: '0.2rem',
    sm: '0.3rem',
    md: '0.4rem',
    lg: '0.5rem',
    xl: '0.6rem',
});

const COLOR_CLASSES = Object.freeze({
    neutral: 'text-neutral',
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    info: 'text-info',
});

const BACKGROUND_CLASSES = Object.freeze({
    neutral: 'bg-neutral text-neutral-content border-neutral-content/25 border',
    primary: 'bg-primary text-primary-content border-primary-content/25 border',
    secondary: 'bg-secondary text-secondary-content border-secondary-content/25 border',
    accent: 'bg-accent text-accent-content border-accent-content/25 border',
    success: 'bg-success text-success-content border-success-content/25 border',
    warning: 'bg-warning text-warning-content border-warning-content/25 border',
    error: 'bg-error text-error-content border-error-content/25 border',
    info: 'bg-info text-info-content border-info-content/25 border',
});

function colorToken(value) {
    if (typeof value !== 'string') return null;
    const token = value.trim();
    return SEMANTIC_COLORS.has(token) ? token : null;
}

function lengthValue(value, fallback, tokens = null) {
    if (typeof value !== 'string') return fallback;

    const normalized = value.trim();
    if (tokens?.[normalized]) return tokens[normalized];
    return normalized || fallback;
}

function resolvedThickness(attrs, size) {
    if (attrs.has('thickness')) {
        return lengthValue(attrs.get('thickness'), THICKNESS_VALUES.md, THICKNESS_VALUES);
    }

    const sizeToken = attrs.get('size');
    if (typeof sizeToken === 'string' && THICKNESS_VALUES[sizeToken]) {
        return THICKNESS_VALUES[sizeToken];
    }

    return `max(1px, calc(${size} * 0.1))`;
}

export function radialProgressAdapter({ attrs }) {
    const progress = resolveProgressState(attrs);
    const background = colorToken(attrs.get('background'));
    const color = colorToken(attrs.get('color')) ?? 'primary';
    const size = lengthValue(attrs.get('size'), SIZE_VALUES.md, SIZE_VALUES);
    const thickness = resolvedThickness(attrs, size);
    const palette = background ? BACKGROUND_CLASSES[background] : COLOR_CLASSES[color];
    const borderWidth = background
        ? `; border-width: max(1px, calc(${thickness} * 0.5))`
        : '';

    return {
        host: {
            class: ['radial-progress', palette],
            style: `--value: ${progress.percentage}; --size: ${size}; --thickness: ${thickness}${borderWidth}`,
        },
    };
}
