export const COMPONENT_SELECTOR = '[x-is], [x-is\\.scoped], [x-is\\.unscoped]';
export const ATTACHMENT_SELECTOR = '[x-as], [x-as\\.scoped], [x-as\\.unscoped]';

export function hasComponentDirective(element) {
    return element.hasAttribute('x-is')
        || element.hasAttribute('x-is.scoped')
        || element.hasAttribute('x-is.unscoped');
}
