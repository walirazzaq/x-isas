import { Component } from '../../component.js';
import { renderElement, safeSlotText } from '../../support/html.js';
import { Part } from '../../support/part.js';
import { resolveProgressState } from '../../support/progress.js';

function resolvedContent(slots, attrs, name) {
    if (slots.has(name)) return slots.get(name).html();
    if (!attrs.has(name)) return '';

    const value = attrs.get(name);
    if (value === true || value === null || value === undefined) return '';
    return safeSlotText(String(value));
}

export class Progress extends Component {
    static structural = true;

    static parts = {
        bar: {
            tag: 'progress',
            render: () => '',
        },
    };

    prepareRender() {
        if (this.el.localName === 'progress') {
            return { nativeHost: true };
        }

        const bars = this.parts.all('bar');
        if (bars.length > 1) {
            throw new Error("Component 'progress' allows only one x-part='bar'.");
        }

        let bar = bars[0] ?? Part.generated('bar', {
            descriptor: this.runtime.partDescriptors.get('bar'),
            attrs: this.attrs.for('bar').set('data-isas-progress-bar', ''),
        });

        if (bar.tagName !== 'progress') {
            throw new Error(
                "Component 'progress' requires x-part='bar' to use a <progress> element.",
            );
        }

        const progress = resolveProgressState(this.attrs, bar.attrs, {
            indeterminateWhenMissing: true,
        });

        if (progress.determinate) {
            bar.attrs = bar.attrs
                .set('value', progress.value)
                .set('max', progress.max);
        } else {
            bar.attrs = bar.attrs.remove('value');
            bar.attrs = progress.maxPresent
                ? bar.attrs.set('max', progress.max)
                : bar.attrs.remove('max');
        }

        if (bar.generated) {
            bar.authoredAttrs = bar.attrs.clone();
            this.parts.add(bar);
        } else {
            this.parts.replace(bar);
        }

        const label = resolvedContent(this.slots, this.attrs, 'label');
        const description = resolvedContent(this.slots, this.attrs, 'description');
        const hasExplicitLabelEnd = this.slots.has('label-end') || this.attrs.has('label-end');
        const labelEnd = hasExplicitLabelEnd
            ? resolvedContent(this.slots, this.attrs, 'label-end')
            : (progress.determinate ? `${Math.round(progress.percentage)}%` : '');

        return {
            nativeHost: false,
            progress,
            label,
            labelEnd,
            description,
        };
    }

    render() {
        if (this.view.nativeHost) return undefined;

        const label = this.view.label
            ? renderElement('div', this.attrs.for('label'), this.view.label)
            : '';
        const labelEnd = this.view.labelEnd
            ? renderElement('div', this.attrs.for('label-end'), this.view.labelEnd)
            : '';
        const labelRow = label || labelEnd
            ? renderElement(
                'div',
                this.attrs.for('label-row'),
                `${label || '<div></div>'}${labelEnd}`,
            )
            : '';
        const description = this.view.description
            ? renderElement(
                'div',
                this.attrs.for('description'),
                this.view.description,
            )
            : '';
        const bar = this.parts.first('bar');

        return `${labelRow}${bar.html(this)}${description}`;
    }
}
