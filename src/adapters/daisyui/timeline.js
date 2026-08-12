import { resolveTimelineItemView } from '../../components/timeline/timeline.js';

const DIRECTION_CLASSES = Object.freeze({
    vertical: 'timeline-vertical',
    horizontal: 'timeline-horizontal',
});

function itemAttributes({ attrs, slots }) {
    const view = resolveTimelineItemView(attrs, slots);
    const boxStart = view.box === 'start' || view.box === 'both';
    const boxEnd = view.box === 'end' || view.box === 'both';

    return {
        parts: view.composed
            ? {
                start: {
                    class: ['timeline-start', boxStart ? 'timeline-box' : ''],
                },
                middle: { class: 'timeline-middle' },
                end: {
                    class: ['timeline-end', boxEnd ? 'timeline-box' : ''],
                },
            }
            : {},
    };
}

export function timelineAdapter({ attrs }) {
    const direction = String(attrs.get('direction') ?? '').toLowerCase();

    return {
        host: {
            class: [
                'timeline',
                DIRECTION_CLASSES[direction] ?? '',
                attrs.boolean('compact') ? 'timeline-compact' : '',
                attrs.boolean('snap-icon') ? 'timeline-snap-icon' : '',
            ],
        },
        parts: {
            item: itemAttributes,
        },
    };
}
