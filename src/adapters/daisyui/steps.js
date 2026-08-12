import { resolveStepView } from '../../components/steps/steps.js';

const COLOR_CLASSES = Object.freeze({
    neutral: 'step-neutral',
    primary: 'step-primary',
    secondary: 'step-secondary',
    accent: 'step-accent',
    info: 'step-info',
    success: 'step-success',
    warning: 'step-warning',
    error: 'step-error',
});

const DIRECTION_CLASSES = Object.freeze({
    vertical: 'steps-vertical',
    horizontal: 'steps-horizontal',
});

function stepAttributes({ attrs, slots }) {
    const view = resolveStepView(attrs, slots);

    return {
        host: {
            class: [
                'step',
                COLOR_CLASSES[String(attrs.get('color') ?? '').toLowerCase()] ?? '',
            ],
        },
        parts: view.composed
            ? {
                marker: { class: 'step-icon' },
                label: { class: 'min-w-0' },
            }
            : {},
    };
}

export function stepsAdapter({ attrs }) {
    const direction = String(attrs.get('direction') ?? '').toLowerCase();

    return {
        host: {
            class: [
                'steps',
                DIRECTION_CLASSES[direction] ?? '',
            ],
        },
        parts: {
            step: stepAttributes,
        },
    };
}
