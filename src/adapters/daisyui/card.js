const SIZE_CLASSES = Object.freeze({
    xs: 'card-xs',
    sm: 'card-sm',
    md: 'card-md',
    lg: 'card-lg',
    xl: 'card-xl',
});

const VARIANT_CLASSES = Object.freeze({
    border: 'card-border',
    dash: 'card-dash',
});

export function cardAdapter({ attrs }) {
    const size = SIZE_CLASSES[String(attrs.get('size') ?? '').toLowerCase()] ?? '';
    const variant = VARIANT_CLASSES[String(attrs.get('variant') ?? '').toLowerCase()] ?? '';

    return {
        host: {
            class: [
                'card',
                size,
                variant,
                attrs.boolean('side') ? 'card-side' : '',
                attrs.boolean('image-full') ? 'image-full' : '',
            ],
        },
        parts: {
            body: {
                host: { class: 'card-body' },
                slots: {
                    title: { class: 'card-title' },
                    actions: { class: 'card-actions' },
                },
            },
        },
    };
}
