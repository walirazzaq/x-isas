import { Component } from '../../component.js';
import {
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNode,
} from '../../support/html.js';

const COMPOSED_ATTRIBUTES = new Set(['icon', 'label']);
const COMPOSED_NAMESPACES = ['icon:', 'label:'];

function composedStep(attrs, slots) {
    if (slots.has('icon')) return true;

    return attrs.entries().some(([name]) => (
        COMPOSED_ATTRIBUTES.has(name)
        || COMPOSED_NAMESPACES.some((prefix) => name.startsWith(prefix))
    ));
}

export function resolveStepView(attrs, slots) {
    const composed = composedStep(attrs, slots);
    const icon = attrs.get('icon');

    return {
        composed,
        hasIcon: slots.has('icon') || Boolean(icon),
        icon: icon ? String(icon) : '',
    };
}

function prepareStep({ part, attrs, slots }) {
    if (part.tagName !== 'li') {
        throw new Error("Component 'steps' requires x-part='step' to use a <li> element.");
    }

    const view = resolveStepView(attrs, slots);
    if (!view.composed || hasVisibleContent(slots.get('default'))) return view;

    const label = attrs.get('label');
    if (label !== false && label !== null && label !== undefined) {
        slots.set('default', safeSlotText(String(label)));
    }

    return view;
}

function renderStep({ attrs, slots, view, renderDefault }) {
    if (!view.composed) return renderDefault();

    const iconAttributes = view.icon && !slots.has('icon')
        ? attrs.for('icon').merge({ class: view.icon })
        : attrs.for('icon');
    const iconContent = slots.has('icon') ? slots.get('icon').html() : '';
    const icon = view.hasIcon
        ? renderElement(
            'span',
            attrs.for('marker'),
            renderElement('span', iconAttributes, iconContent),
        )
        : '';
    const label = renderElement('span', attrs.for('label'), slots.get('default').html());

    return `${icon}${label}`;
}

const stepPart = Object.freeze({
    tag: 'li',
    prepare: prepareStep,
    render: renderStep,
});

/** A Steps host that owns shallow step parts while preserving other children. */
export class Steps extends Component {
    static structural = true;

    static parts = {
        step: stepPart,
    };

    render() {
        const parts = new Map(this.parts.ordered().map((part) => [part.position, part]));

        return this.source.childNodes().map((node, position) => (
            parts.has(position) ? parts.get(position).html(this) : serializeNode(node)
        )).join('');
    }
}
