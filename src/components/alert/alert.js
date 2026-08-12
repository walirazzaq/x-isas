import { Component } from '../../component.js';
import { escapeHtml, renderElement } from '../../support/html.js';
import {
    prepareItemAppend,
    prepareItemPrepend,
} from '../../support/item-accessories.js';

function resolvedContent(attrs, slots, name) {
    if (slots.has(name)) return slots.get(name).html();
    if (!attrs.has(name)) return '';

    const value = attrs.get(name);
    if (value === true || value === false || value === null || value === undefined) return '';
    return escapeHtml(String(value));
}

export class Alert extends Component {
    static structural = true;

    prepareRender() {
        prepareItemPrepend(this.attrs, this.slots, { keyPrefix: 'alert' });
        prepareItemAppend(this.attrs, this.slots, { keyPrefix: 'alert' });

        const hasHeading = this.slots.has('heading') || this.attrs.has('heading');
        const hasDescription = this.slots.has('description') || this.attrs.has('description');

        return {
            hasPrepend: this.slots.has('prepend'),
            hasAppend: this.slots.has('append'),
            hasHeading,
            hasDescription,
            heading: resolvedContent(this.attrs, this.slots, 'heading'),
            description: hasDescription
                ? resolvedContent(this.attrs, this.slots, 'description')
                : (hasHeading ? this.slots.get('default').html() : ''),
        };
    }

    render() {
        const prepend = this.view.hasPrepend
            ? renderElement('div', this.attrs.for('prepend'), this.slots.get('prepend').html())
            : '';
        const append = this.view.hasAppend
            ? renderElement('div', this.attrs.for('append'), this.slots.get('append').html())
            : '';
        const composed = this.view.hasHeading || this.view.hasDescription;
        const content = composed
            ? `${this.view.heading
                ? renderElement('div', this.attrs.for('heading'), this.view.heading)
                : ''}${this.view.description
                ? renderElement('div', this.attrs.for('description'), this.view.description)
                : ''}`
            : this.slots.get('default').html();

        return `${prepend}${renderElement('div', this.attrs.for('content'), content)}${append}`;
    }
}
