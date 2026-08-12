export function accessoryParts(attrs, slots) {
    const parts = {};

    if (attrs.get('icon') || slots.has('prepend')) {
        parts.prepend = { class: 'inline-flex items-center justify-center' };
    }

    if (attrs.get('icon-end') || slots.has('append')) {
        parts.append = { class: 'inline-flex items-center justify-center' };
    }

    return parts;
}

export function variantAdapter({
    attrs,
    slots,
    base,
    colors,
    sizes,
    variants,
    accessories = false,
}) {
    const color = colors[attrs.get('color')] ?? '';
    const size = sizes[attrs.get('size')] ?? '';
    const variant = variants[attrs.get('variant')] ?? '';

    return {
        host: {
            class: [base, color, size, variant],
        },
        parts: accessories ? accessoryParts(attrs, slots) : {},
    };
}
