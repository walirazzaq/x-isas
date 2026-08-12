import { Component } from '../../component.js';

function digit(part) {
    const element = document.createElement('span');
    element.style.setProperty('--value', part);
    return element;
}

function text(part) {
    const element = document.createElement('span');
    element.classList.add('countdown-ignore');
    element.textContent = part;
    return element;
}

export class Countdown extends Component {
    static structural = true;

    prepareRender() {
        const value = this.attrs.has('value')
            ? this.attrs.get('value')
            : this.slots.get('default').text().trim();
        const normalizedValue = String(value ?? '');
        const parts = (normalizedValue.match(/\D+|\d/g) ?? []).map((part) => ({
            type: /^\d$/.test(part) ? 'digit' : 'text',
            value: part,
        }));

        return { value: normalizedValue, parts };
    }

    render() {
        return this.view.parts
            .map((part) => part.type === 'digit' ? digit(part.value) : text(part.value))
            .map((element) => element.outerHTML)
            .join('');
    }
}
