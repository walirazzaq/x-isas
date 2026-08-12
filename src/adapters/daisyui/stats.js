import { resolveStatsPartView } from '../../components/stats/stats.js';

const DIRECTION_CLASSES = Object.freeze({
    vertical: 'stats-vertical',
    horizontal: 'stats-horizontal',
});

function statAttributes({ attrs, slots }) {
    const view = resolveStatsPartView(attrs, slots);

    return {
        host: { class: 'stat' },
        parts: view.composed
            ? {
                figure: { class: 'stat-figure' },
                heading: { class: 'stat-title' },
                value: { class: 'stat-value' },
                description: { class: 'stat-desc' },
                actions: { class: 'stat-actions' },
            }
            : {},
    };
}

export function statsAdapter({ attrs }) {
    const direction = String(attrs.get('direction') ?? '').toLowerCase();

    return {
        host: {
            class: [
                'stats',
                DIRECTION_CLASSES[direction] ?? '',
            ],
        },
        parts: {
            stat: statAttributes,
        },
    };
}
