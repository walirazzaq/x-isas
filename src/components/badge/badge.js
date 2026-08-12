import { Component } from '../../component.js';
import {
    prepareAccessories,
    renderAccessories,
} from '../../support/render-accessories.js';

export class Badge extends Component {
    static structural = true;

    prepareRender() {
        const contentIsExternallyOwned = ['x-text', 'x-html', 'wire:text']
            .some((name) => this.attrs.has(name))
            || this.attrs.entries().some(([name]) => name.startsWith('wire:text.'));

        prepareAccessories(this.attrs, this.slots);

        return {
            contentIsExternallyOwned,
            hasPrepend: this.slots.has('prepend'),
            hasAppend: this.slots.has('append'),
        };
    }

    render() {
        if (this.view.contentIsExternallyOwned) return undefined;

        return renderAccessories(this.attrs, this.slots);
    }
}
