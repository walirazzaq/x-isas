import { Component } from '../../component.js';
import {
    prepareAccessories,
    renderAccessories,
} from '../../support/render-accessories.js';

export class Button extends Component {
    static structural = true;

    prepareRender() {
        prepareAccessories(this.attrs, this.slots);

        return {
            hasPrepend: this.slots.has('prepend'),
            hasAppend: this.slots.has('append'),
        };
    }

    render() {
        return renderAccessories(this.attrs, this.slots);
    }
}
