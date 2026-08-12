import { Component } from '../../component.js';
import { renderElement } from '../../support/html.js';
import { Part } from '../../support/part.js';
import { prepareAccessories } from '../../support/render-accessories.js';
import { translateNativeLivewireAliases } from './native-livewire-alias.js';

const FALSE_ERROR_VALUES = new Set(['false', '0', 'null', 'off', 'no']);
const TRUE_ERROR_VALUES = new Set(['', 'true', '1']);
const NATIVE_MARKER = 'data-isas-input-native';
const ACTION_MARKER = 'data-isas-input-action';

function resolveError(attributes) {
    if (!attributes.has('error')) return { active: false, message: '' };

    const raw = attributes.get('error');
    if (raw === false || raw === null || raw === undefined) {
        return { active: false, message: '' };
    }

    const value = String(raw).trim();
    const normalized = value.toLowerCase();
    if (FALSE_ERROR_VALUES.has(normalized)) return { active: false, message: '' };
    if (TRUE_ERROR_VALUES.has(normalized)) return { active: true, message: '' };

    return { active: true, message: value };
}

function renderSlotWrapper(attributes, slots, name) {
    if (!slots.has(name)) return '';
    return renderElement('span', attributes.for(name), slots.get(name).html());
}

export class Input extends Component {
    static structural = true;

    static parts = {
        native: {
            tag: 'input',
            render: () => '',
        },
    };

    mount() {
        this.destroyed = false;
        this.validitySyncQueued = false;
        this.validityNative = null;
        this.ownedValidityMessage = '';

        this.listen(this.el, 'click', (event) => {
            const action = event.target.closest?.(`[${ACTION_MARKER}]`);
            if (!action || action.parentElement !== this.el) return;

            if (action.getAttribute(ACTION_MARKER) === 'clear') {
                this.clear();
                return;
            }

            if (action.getAttribute(ACTION_MARKER) === 'error') {
                this.showError();
            }
        });
    }

    mergeScope() {
        return {
            clear: this.clear,
            showError: this.showError,
        };
    }

    clear() {
        const native = this.nativeElement();
        if (!native || native.disabled || native.readOnly) return false;

        native.value = '';
        native.dispatchEvent(new Event('input', { bubbles: true }));
        native.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    showError() {
        const native = this.nativeElement();
        if (!native) return false;

        native.focus();
        return native.reportValidity();
    }

    prepareRender() {
        prepareAccessories(this.attrs, this.slots);

        const error = resolveError(this.attrs);
        const native = this.prepareNativePart(error);
        this.prepareErrorIcon(error);

        return {
            error,
            nativeDisabled: native.attrs.boolean('disabled'),
            nativeReadonly: native.attrs.boolean('readonly'),
            hasPrepend: this.slots.has('prepend'),
            hasAppend: this.slots.has('append'),
        };
    }

    prepareNativePart(error) {
        const nativeParts = this.parts.all('native');
        if (nativeParts.length > 1) {
            throw new Error("Component 'input' allows only one x-part='native'.");
        }

        let native = nativeParts[0] ?? Part.generated('native', {
            descriptor: this.runtime.partDescriptors.get('native'),
            attrs: this.attrs.for('native'),
        });

        if (native.tagName !== 'input') {
            throw new Error("Component 'input' requires x-part='native' to use an <input> element.");
        }

        native.attrs = translateNativeLivewireAliases(native.attrs)
            .set(NATIVE_MARKER, '');

        if (error.active) native.attrs = native.attrs.set('aria-invalid', 'true');

        if (native.generated) {
            native.authoredAttrs = native.attrs.clone();
            this.parts.add(native);
        } else {
            this.parts.replace(native);
        }

        return native;
    }

    prepareErrorIcon(error) {
        if (!error.active) return;

        let attributes = this.attrs.for('error-icon');
        if (this.slots.has('error-icon')) {
            this.slots.set('error-icon', this.slots.get('error-icon').attrs(attributes));
        } else {
            const icon = this.attrs.get('error-icon');
            if (icon) attributes = attributes.class(icon);
            this.slots.set('error-icon', renderElement('span', attributes));
        }
    }

    render() {
        const native = this.parts.first('native');
        const prepend = renderSlotWrapper(this.attrs, this.slots, 'prepend');
        const append = renderSlotWrapper(this.attrs, this.slots, 'append');
        const clear = this.attrs.boolean('clearable') ? this.renderClearAction() : '';
        const error = this.view.error.active ? this.renderErrorAction() : '';

        this.queueValiditySync(this.view.error.message);

        return `${prepend}${native.html(this)}${append}${clear}${error}`;
    }

    renderClearAction() {
        let attributes = this.attrs.for('clear-action').merge({
            type: 'button',
            tabindex: '-1',
            'aria-label': 'Clear input',
            [ACTION_MARKER]: 'clear',
        });

        if (this.view.nativeDisabled || this.view.nativeReadonly) {
            attributes = attributes.set('disabled', true);
        }

        return renderElement(
            'button',
            attributes,
            renderElement('span', this.attrs.for('clear-icon')),
        );
    }

    renderErrorAction() {
        const attributes = this.attrs.for('error-action').merge({
            type: 'button',
            tabindex: '-1',
            'aria-label': 'Show validation error',
            [ACTION_MARKER]: 'error',
        });

        return renderElement('button', attributes, this.slots.get('error-icon').html());
    }

    nativeElement() {
        return [...this.el.children].find((child) => (
            child.localName === 'input' && child.hasAttribute(NATIVE_MARKER)
        )) ?? null;
    }

    queueValiditySync(message) {
        this.pendingValidityMessage = message;
        if (this.validitySyncQueued) return;

        this.validitySyncQueued = true;
        queueMicrotask(() => {
            this.validitySyncQueued = false;
            if (this.destroyed || !this.el.isConnected) return;
            this.syncValidity(this.pendingValidityMessage);
        });
    }

    syncValidity(message) {
        const native = this.nativeElement();
        if (native !== this.validityNative) {
            this.clearOwnedValidity();
            this.validityNative = native;
            this.ownedValidityMessage = '';
        }

        if (!native) return;

        if (message) {
            native.setCustomValidity(message);
            this.ownedValidityMessage = message;
        } else {
            this.clearOwnedValidity();
        }
    }

    clearOwnedValidity() {
        if (this.validityNative
            && this.ownedValidityMessage
            && this.validityNative.validationMessage === this.ownedValidityMessage) {
            this.validityNative.setCustomValidity('');
        }
        this.ownedValidityMessage = '';
    }

    destroy() {
        this.destroyed = true;
        this.clearOwnedValidity();
        this.validityNative = null;
    }
}

export { resolveError };
