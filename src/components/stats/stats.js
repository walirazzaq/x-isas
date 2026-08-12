import { Component } from '../../component.js';
import {
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNode,
} from '../../support/html.js';

const COMPOSED_ATTRIBUTES = new Set([
    'heading',
    'value',
    'description',
    'icon',
]);
const COMPOSED_NAMESPACES = [
    'figure:',
    'icon:',
    'heading:',
    'value:',
    'description:',
    'actions:',
];
const COMPOSED_SLOTS = [
    'figure',
    'heading',
    'value',
    'description',
    'actions',
];
const REGION_ORDER = ['figure', 'heading', 'value', 'description', 'actions'];

function composedStat(attrs, slots) {
    if (COMPOSED_SLOTS.some((name) => slots.has(name))) return true;

    return attrs.entries().some(([name]) => (
        COMPOSED_ATTRIBUTES.has(name)
        || COMPOSED_NAMESPACES.some((prefix) => name.startsWith(prefix))
    ));
}

function attributeContent(attrs, name) {
    if (!attrs.has(name)) return '';

    const value = attrs.get(name);
    if (value === true || value === false || value === null || value === undefined) return '';
    return safeSlotText(String(value));
}

export function resolveStatsPartView(attrs, slots) {
    return {
        composed: composedStat(attrs, slots),
    };
}

function prepareStat({ attrs, slots }) {
    const view = resolveStatsPartView(attrs, slots);
    if (!view.composed) return view;

    if (!slots.has('figure')) {
        const icon = attrs.get('icon');
        if (icon) {
            slots.set('figure', renderElement(
                'span',
                attrs.for('icon').merge({ class: String(icon) }),
            ));
        }
    }

    if (!slots.has('heading')) {
        slots.set('heading', attributeContent(attrs, 'heading'));
    }

    if (!slots.has('value')) {
        if (hasVisibleContent(slots.get('default'))) {
            slots.set('value', slots.get('default'));
        } else {
            slots.set('value', attributeContent(attrs, 'value'));
        }
    }

    if (!slots.has('description')) {
        slots.set('description', attributeContent(attrs, 'description'));
    }

    return view;
}

function renderRegion(attrs, slots, name) {
    if (!slots.has(name)) return '';
    return renderElement('div', attrs.for(name), slots.get(name).html());
}

function renderStat({ attrs, slots, view, renderDefault }) {
    if (!view.composed) return renderDefault();

    return REGION_ORDER.map((name) => renderRegion(attrs, slots, name)).join('');
}

const statPart = Object.freeze({
    prepare: prepareStat,
    render: renderStat,
});

/** A Stats host that owns shallow, tag-agnostic stat parts. */
export class Stats extends Component {
    static structural = true;

    static parts = {
        stat: statPart,
    };

    render() {
        const parts = new Map(this.parts.ordered().map((part) => [part.position, part]));

        return this.source.childNodes().map((node, position) => (
            parts.has(position) ? parts.get(position).html(this) : serializeNode(node)
        )).join('');
    }
}
