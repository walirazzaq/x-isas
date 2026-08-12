import { resolveError } from '../../components/input/input.js';
import { resolveInputStyleClasses } from './input-styles.js';

export function inputAdapter({ attrs, slots }) {
    const error = resolveError(attrs);
    const { color, size, variant } = resolveInputStyleClasses(attrs, {
        invalid: error.active,
    });
    const parts = {
        native: { host: { class: 'grow min-w-0' } },
        prepend: { class: 'inline-flex shrink-0 items-center' },
        append: { class: 'inline-flex shrink-0 items-center' },
        'clear-action': {
            class: 'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center p-0 opacity-50 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25',
        },
        'clear-icon': { class: 'i-tabler-x' },
        'error-action': {
            class: 'text-error inline-flex size-6 shrink-0 cursor-pointer items-center justify-center p-0 opacity-85 transition-opacity hover:opacity-100',
        },
    };

    if (!attrs.get('error-icon') && !slots.has('error-icon')) {
        parts['error-icon'] = { class: 'i-tabler-alert-circle' };
    }

    return {
        host: {
            class: ['input', 'group', size, color, variant],
        },
        parts,
    };
}
