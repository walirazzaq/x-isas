import { Component } from '../../component.js';
import { generatedComponentAttributes } from '../../support/generated-component.js';
import {
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNodes,
} from '../../support/html.js';

const REGION_NAMES = Object.freeze(['image', 'header', 'bubble', 'footer']);
const REGION_NAME_SET = new Set(REGION_NAMES);
const FALSE_AVATAR_VALUES = new Set(['false', '0', 'null', 'off', 'no']);
const TRUE_AVATAR_VALUES = new Set(['', 'true', '1']);

function attributeContent(attrs, name) {
    if (!attrs.has(name)) return '';

    const value = attrs.get(name);
    if (value === true || value === false || value === null || value === undefined) return '';
    return safeSlotText(String(value));
}

function generatedAvatar(attrs) {
    if (!attrs.has('avatar')) return '';

    const raw = attrs.get('avatar');
    if (raw === false || raw === null || raw === undefined) return '';

    const value = String(raw).trim();
    if (FALSE_AVATAR_VALUES.has(value.toLowerCase())) return '';

    const defaults = {
        'x-is': 'avatar',
        ...generatedComponentAttributes('chat:avatar'),
    };

    if (!TRUE_AVATAR_VALUES.has(value.toLowerCase())) defaults.src = value;
    return renderElement('span', attrs.for('avatar').merge(defaults));
}

/** A single composed chat message with consumer-owned conversation semantics. */
export class Chat extends Component {
    static structural = true;

    prepareRender() {
        if (this.attrs.boolean('raw')) return { raw: true };

        const namedSlots = this.slots.names().filter((name) => name !== 'default');
        const unsupported = namedSlots.filter((name) => !REGION_NAME_SET.has(name));

        if (unsupported.length > 0) {
            throw new Error(
                `Component 'chat' does not support slot='${unsupported[0]}'. `
                + "Use 'image', 'header', 'bubble', or 'footer'.",
            );
        }

        if (this.slots.has('bubble') && hasVisibleContent(this.slots.get('default'))) {
            throw new Error(
                "Component 'chat' cannot mix un-slotted content with a 'bubble' slot.",
            );
        }

        if (!this.slots.has('image')) {
            const avatar = generatedAvatar(this.attrs);
            if (avatar) this.slots.set('image', avatar);
        }

        if (!this.slots.has('header')) {
            const header = attributeContent(this.attrs, 'header');
            if (header) this.slots.set('header', header);
        }

        if (!this.slots.has('bubble')) {
            this.slots.set('bubble', this.slots.get('default'));
        }

        if (!this.slots.has('footer')) {
            const footer = attributeContent(this.attrs, 'footer');
            if (footer) this.slots.set('footer', footer);
        }

        return { raw: false };
    }

    render() {
        if (this.view.raw) return serializeNodes(this.source.childNodes());

        return REGION_NAMES
            .filter((name) => name === 'bubble' || this.slots.has(name))
            .map((name) => renderElement(
                'div',
                this.attrs.for(name),
                this.slots.get(name).html(),
            ))
            .join('');
    }
}
