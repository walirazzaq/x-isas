export const GENERATED_COMPONENT_ATTRIBUTE = 'data-isas-generated';
export const GENERATED_COMPONENT_CONTENT_ATTRIBUTE = 'data-isas-generated-content';

export function generatedComponentAttributes(key, { content = 'preserve' } = {}) {
    const value = String(key ?? '').trim();
    if (!value) throw new Error('Generated component keys cannot be empty.');

    return {
        [GENERATED_COMPONENT_ATTRIBUTE]: value,
        [GENERATED_COMPONENT_CONTENT_ATTRIBUTE]: content === 'morph' ? 'morph' : undefined,
    };
}

export function isGeneratedComponent(element) {
    return element?.nodeType === 1
        && element.hasAttribute(GENERATED_COMPONENT_ATTRIBUTE);
}
