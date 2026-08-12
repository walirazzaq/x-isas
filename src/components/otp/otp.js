import { Component } from '../../component.js';
import { hasVisibleContent, renderElement } from '../../support/html.js';
import { Part } from '../../support/part.js';
import { translateNativeLivewireAliases } from '../input/native-livewire-alias.js';

const DEFAULT_LENGTH = 6;
const MIN_LENGTH = 1;
const MAX_LENGTH = 8;
const NATIVE_MARKER = 'data-isas-otp-native';

export function resolveOtpLength(attributes) {
    if (!attributes.has('length')) return DEFAULT_LENGTH;

    const value = String(attributes.get('length') ?? '').trim();
    if (!/^[1-8]$/.test(value)) {
        throw new Error(
            `Component 'otp' length must be an integer from ${MIN_LENGTH} to ${MAX_LENGTH}.`,
        );
    }

    return Number(value);
}

function resolvesRequired(attributes) {
    return !attributes.has('required') || attributes.boolean('required');
}

export class Otp extends Component {
    static structural = true;

    static parts = {
        native: {
            tag: 'input',
            render: () => '',
        },
    };

    mount() {
        if (this.el.localName !== 'label') {
            throw new Error("Component 'otp' requires an authored <label> host.");
        }

        this.listen(this.el, 'input', (event) => {
            const native = event.target;
            if (native?.parentElement !== this.el || !native.hasAttribute(NATIVE_MARKER)) return;
            this.complete(native);
        });
    }

    prepareRender() {
        for (const name of this.slots.names()) {
            if (hasVisibleContent(this.slots.get(name))) {
                throw new Error(
                    "Component 'otp' only accepts an optional x-part='native' child.",
                );
            }
        }

        const length = resolveOtpLength(this.attrs);
        const required = resolvesRequired(this.attrs);
        const invalid = this.attrs.boolean('invalid');
        const native = this.prepareNativePart({ length, required, invalid });

        return { length, required, invalid, native };
    }

    prepareNativePart({ length, required, invalid }) {
        const nativeParts = this.parts.all('native');
        if (nativeParts.length > 1) {
            throw new Error("Component 'otp' allows only one x-part='native'.");
        }

        let native = nativeParts[0] ?? Part.generated('native', {
            descriptor: this.runtime.partDescriptors.get('native'),
            attrs: this.attrs.for('native'),
        });

        if (native.tagName !== 'input') {
            throw new Error("Component 'otp' requires x-part='native' to use an <input> element.");
        }

        native.attrs = translateNativeLivewireAliases(native.attrs).merge({
            type: 'text',
            autocomplete: 'one-time-code',
            inputmode: 'numeric',
            maxlength: String(length),
            pattern: `[0-9]{${length}}`,
            required: required ? true : undefined,
            'aria-invalid': invalid ? 'true' : undefined,
        });

        if (native.attrs.has('required') && !native.attrs.boolean('required')) {
            native.attrs = native.attrs.set('required', false);
        }

        native.attrs = native.attrs.set(NATIVE_MARKER, '');

        if (native.generated) {
            native.authoredAttrs = native.attrs.clone();
            this.parts.add(native);
        } else {
            this.parts.replace(native);
        }

        return native;
    }

    render() {
        const cellAttributes = this.attrs.for('cell').merge({
            'aria-hidden': 'true',
        });
        const cells = Array.from(
            { length: this.view.length },
            () => renderElement('span', cellAttributes),
        ).join('');
        const native = this.parts.first('native');

        return `${cells}${native.html(this)}`;
    }

    complete(native) {
        const length = this.view?.length ?? resolveOtpLength(this.attrs);
        if (native.value.length !== length || !native.validity.valid) return false;

        const event = new CustomEvent('complete', {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { value: native.value, length },
        });
        const accepted = this.el.dispatchEvent(event);

        if (accepted && this.attrs.boolean('auto-submit')) {
            this.el.closest('form')?.requestSubmit?.();
        }

        return accepted;
    }

    nativeElement() {
        return [...this.el.children].find((child) => (
            child.localName === 'input' && child.hasAttribute(NATIVE_MARKER)
        )) ?? null;
    }
}
