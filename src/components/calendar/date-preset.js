import { Component } from '../../component.js';

export class DatePreset extends Component {
    static attachable = true;
    static scoped = false;

    mount() {
        this.picker = this.owner('date-picker');
        if (!this.picker) {
            throw new Error("Component 'date-preset' requires an ancestor component 'date-picker'.");
        }
        this.listen(this.el, 'click', (event) => {
            if (this.el.matches('[disabled], [aria-disabled="true"]')) return;
            event.preventDefault();
            this.picker.applyPreset(
                this.el.getAttribute('value'),
                this.el.getAttribute('preset'),
            );
        });
    }

    destroy() {
        this.picker = null;
    }
}
