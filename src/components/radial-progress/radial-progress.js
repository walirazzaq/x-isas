import { Component } from '../../component.js';
import { hasVisibleContent } from '../../support/html.js';
import { resolveProgressState } from '../../support/progress.js';

export class RadialProgress extends Component {
    static structural = true;

    prepareRender() {
        const progress = resolveProgressState(this.attrs);

        return {
            progress,
            hasAuthoredContent: hasVisibleContent(this.slots.get('default')),
            showValue: !this.attrs.has('show-value') || this.attrs.boolean('show-value'),
        };
    }

    hostAttributes() {
        return {
            role: 'progressbar',
            'aria-valuenow': this.view.progress.percentage,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
        };
    }

    render() {
        if (this.view.hasAuthoredContent) return this.slots.get('default').html();
        if (!this.view.showValue) return '';
        return `${Math.round(this.view.progress.percentage)}%`;
    }
}
