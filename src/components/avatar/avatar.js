import { Component } from '../../component.js';
import { hasVisibleContent, renderElement } from '../../support/html.js';

function slotContainsImage(slot) {
    return slot.all().some((node) => (
        node.nodeType === Node.ELEMENT_NODE
        && (node.matches('img') || node.querySelector('img'))
    ));
}

export function resolveAvatarContent(attrs, slots) {
    let source = 'empty';
    let hasImage = false;

    if (hasVisibleContent(slots.get('default'))) {
        source = 'authored';
        hasImage = slotContainsImage(slots.get('default'));
    } else if (attrs.get('src')) {
        source = 'image';
        hasImage = true;
    } else if (attrs.get('icon')) {
        source = 'icon';
    }

    const placeholder = attrs.has('placeholder')
        ? attrs.boolean('placeholder')
        : !hasImage;

    return { source, hasImage, placeholder };
}

export class Avatar extends Component {
    static structural = true;

    prepareRender() {
        const view = resolveAvatarContent(this.attrs, this.slots);

        if (view.source === 'image') {
            const imageAttributes = this.attrs.for('image').merge({
                src: this.attrs.get('src'),
                alt: this.attrs.get('alt') ?? undefined,
            });
            this.slots.set('default', renderElement('img', imageAttributes, null));
        } else if (view.source === 'icon') {
            const iconAttributes = this.attrs.for('icon').merge({
                class: this.attrs.get('icon'),
            });
            this.slots.set('default', renderElement('span', iconAttributes));
        }

        return {
            ...view,
            hasContent: hasVisibleContent(this.slots.get('default')),
        };
    }

    render() {
        return renderElement(
            'div',
            this.attrs.for('content'),
            this.slots.get('default').html(),
        );
    }
}
