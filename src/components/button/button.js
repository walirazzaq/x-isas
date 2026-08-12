import { Component } from '../../component.js';
import { renderElement } from '../../support/html.js';
import {
    prepareAccessories,
    renderAccessories,
} from '../../support/render-accessories.js';

export class Button extends Component {
    static structural = true;

    prepareRender() {
        const authoredPrepend = this.slots.has('prepend');
        prepareAccessories(this.attrs, this.slots);

        const loading = this.attrs.boolean('loading');
        if (loading) {
            const spinner = renderElement('span', this.attrs.for('loading').merge({
                class: 'loading loading-spinner',
                'aria-hidden': 'true',
            }));

            if (authoredPrepend) this.slots.prepend('prepend', spinner);
            else this.slots.set('prepend', spinner);
        }

        return {
            loading,
            hasPrepend: this.slots.has('prepend'),
            hasAppend: this.slots.has('append'),
        };
    }

    hostAttributes() {
        return {
            'aria-busy': this.view.loading ? 'true' : undefined,
        };
    }

    render() {
        return renderAccessories(this.attrs, this.slots);
    }
}
