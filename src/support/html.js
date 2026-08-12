export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function renderElement(tag, attributes, html = '') {
    const serialized = attributes.toString();
    const opening = `<${tag}${serialized ? ` ${serialized}` : ''}>`;

    return html === null ? opening : `${opening}${html}</${tag}>`;
}

export function serializeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.textContent ?? ''}-->`;
    return node.outerHTML ?? node.textContent ?? '';
}

export function serializeNodes(nodes) {
    return [...nodes].map(serializeNode).join('');
}

export function visibleNodes(source) {
    const nodes = typeof source?.all === 'function'
        ? source.all()
        : (source?.content?.childNodes ?? source ?? []);

    return [...nodes].filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent.trim());
        if (node.nodeType === Node.COMMENT_NODE) return false;
        return node.nodeType === Node.ELEMENT_NODE;
    });
}

export function hasVisibleContent(source) {
    return visibleNodes(source).length > 0;
}

// Slot strings are parsed when stored and again when rendered by the host.
export function safeSlotText(value) {
    return escapeHtml(escapeHtml(value));
}

export function setAttributeIfChanged(element, name, value) {
    if (value === false || value === null || value === undefined) {
        if (element.hasAttribute(name)) element.removeAttribute(name);
        return;
    }

    const normalized = value === true ? '' : String(value);
    if (element.getAttribute(name) !== normalized) element.setAttribute(name, normalized);
}

export function setAttributes(element, attributes) {
    for (const [name, value] of attributes.entries()) {
        setAttributeIfChanged(element, name, value);
    }
}
