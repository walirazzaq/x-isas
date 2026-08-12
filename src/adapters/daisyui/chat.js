const PLACEMENT_CLASSES = Object.freeze({
    start: 'chat-start',
    end: 'chat-end',
});

const COLOR_CLASSES = Object.freeze({
    neutral: 'chat-bubble-neutral',
    primary: 'chat-bubble-primary',
    secondary: 'chat-bubble-secondary',
    accent: 'chat-bubble-accent',
    info: 'chat-bubble-info',
    success: 'chat-bubble-success',
    warning: 'chat-bubble-warning',
    error: 'chat-bubble-error',
});

export function chatAdapter({ attrs }) {
    const placement = attrs.has('placement')
        ? PLACEMENT_CLASSES[String(attrs.get('placement')).toLowerCase()] ?? ''
        : PLACEMENT_CLASSES.start;
    const color = COLOR_CLASSES[String(attrs.get('color') ?? '').toLowerCase()] ?? '';

    return {
        host: {
            class: ['chat', placement],
        },
        parts: {
            image: { class: 'chat-image' },
            header: { class: 'chat-header' },
            bubble: { class: ['chat-bubble', color] },
            footer: { class: 'chat-footer' },
        },
    };
}
