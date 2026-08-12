import { Component } from '../../component.js';
import { hasVisibleContent } from '../../support/html.js';
import { Part } from '../../support/part.js';
import { SlotBag } from '../../support/slot-bag.js';

function bodyInnerHtml({ slots }) {
    const title = slots.has('title') ? slots.get('title').html() : '';
    const actions = slots.has('actions') ? slots.get('actions').html() : '';
    return `${title}${slots.get('default').html()}${actions}`;
}

function legacyBodyPosition(source) {
    const nodes = source.childNodes();

    for (let position = 0; position < nodes.length; position += 1) {
        const node = nodes[position];
        if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) continue;
        if (node.nodeType === Node.COMMENT_NODE) continue;
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.hasAttribute('x-part')) continue;
            const slot = node.getAttribute('slot') || 'default';
            if (slot === 'figure' || slot === 'figure-end') continue;
            if (['default', 'title', 'actions'].includes(slot)) return position;
            continue;
        }
        return position;
    }

    return Number.MAX_SAFE_INTEGER;
}

export class Card extends Component {
    static structural = true;

    static parts = {
        body: {
            tag: 'div',
            render: bodyInnerHtml,
        },
    };

    prepareRender() {
        if (hasVisibleContent(this.slots.get('default'))
            || this.slots.has('title')
            || this.slots.has('actions')) {
            const descriptor = this.runtime.partDescriptors.get('body');
            const attrs = this.attrs.for('body');
            const bodySlots = new SlotBag({
                default: this.slots.get('default'),
                title: this.slots.get('title').attrs(attrs.for('title')),
                actions: this.slots.get('actions').attrs(attrs.for('actions')),
            });
            const generated = Part.generated('body', {
                descriptor,
                index: this.parts.all('body').length,
                position: legacyBodyPosition(this.source),
                attrs: attrs.whereDoesntStartWith('title:', 'actions:'),
                slots: bodySlots,
            });
            generated.authoredAttrs = generated.attrs.clone();
            generated.prepare(this);
            this.parts.add(generated);
        }

        return {
            bodyCount: this.parts.all('body').length,
            hasFigure: this.slots.has('figure'),
            hasFigureEnd: this.slots.has('figure-end'),
        };
    }

    render() {
        const figure = this.slots.get('figure').html();
        const bodies = this.parts.ordered().map((part) => part.html(this)).join('');
        const figureEnd = this.slots.get('figure-end').html();
        return `${figure}${bodies}${figureEnd}`;
    }
}
