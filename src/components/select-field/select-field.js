import { AttributeBag } from '../../support/attribute-bag.js';
import { generatedComponentAttributes } from '../../support/generated-component.js';
import { serializeNodes } from '../../support/html.js';
import {
    appendTokens,
    FieldShell,
    validValue,
} from '../field/field-shell.js';
import { resolveError } from '../input/input.js';
import { translateNativeLivewireAliases } from '../input/native-livewire-alias.js';

const SELECT_PROPS = new Set([
    'size', 'color', 'variant', 'multiple', 'disabled', 'searchable', 'filter',
    'close-on-select', 'max-selection-shown', 'mode', 'breakpoint', 'closedby',
    'placeholder', 'icon', 'prefix', 'suffix', 'icon-end', 'name', 'required',
    'form', 'autocomplete', 'value', 'error',
]);
const SELECT_NAMESPACES = Object.freeze([
    'icon:', 'prefix:', 'suffix:', 'icon-end:', 'prepend:', 'append:',
    'trigger:', 'selection:', 'selection-items:', 'selection-item:', 'chip:',
    'more:', 'placeholder:', 'overlay:', 'panel:', 'search:',
    'search-wrapper:', 'empty:', 'options:', 'listbox:',
]);
const NATIVE_SHORTHANDS = new Set([
    'name', 'required', 'form', 'disabled', 'multiple', 'autocomplete', 'value',
]);
const SELECT_METHODS = Object.freeze([
    'select', 'unselect', 'toggle', 'clear', 'selectAll', 'unselectAll',
    'isSelected', 'option', 'item', 'selectedValues', 'search', 'clearSearch',
    'checkValidity', 'reportValidity', 'showError', 'setCustomValidity',
    'show', 'hide', 'close', 'toggleOverlay',
]);

export class SelectField extends FieldShell {
    static fieldName = 'select-field';
    static controlName = 'select';
    static controlMarker = 'data-isas-select-field-select';
    static scopeAlias = '$select';
    static scopeProperty = 'select';
    static safeMethods = SELECT_METHODS;
    static scopeFallbacks = Object.freeze({
        value: '',
        values: Object.freeze([]),
        options: Object.freeze([]),
        selectedOptions: Object.freeze([]),
        selectedOption: null,
        selectedIndex: -1,
        length: 0,
        multiple: false,
        disabled: false,
        hasSelection: false,
        selectedCount: 0,
        query: '',
        filter: 'local',
        formControl: null,
        form: null,
        validity: null,
        valid: true,
        invalid: false,
        validationMessage: '',
        willValidate: false,
        open: false,
        presentation: 'dropdown',
        visibleSelectedOptions: Object.freeze([]),
        hiddenSelectedCount: 0,
    });

    mount() {
        super.mount();
        this.nestedValidation = this.reactive({ active: false, message: '' });
        this.listen(this.el, 'x-isas:select-validation', (event) => {
            if (!event.target?.hasAttribute?.(this.constructor.controlMarker)) return;
            const active = Boolean(event.detail?.active);
            const message = active ? String(event.detail?.message ?? '') : '';
            if (active === this.nestedValidation.active
                && message === this.nestedValidation.message) return;
            this.nestedValidation.active = active;
            this.nestedValidation.message = message;
            this.requestRender();
        });
    }

    shouldGenerateErrorPart() {
        return true;
    }

    fieldError() {
        const own = resolveError(this.attrs);
        return {
            active: own.active || this.nestedValidation.active,
            message: own.message || this.nestedValidation.message,
        };
    }

    controlElement(part) {
        const authored = super.controlElement(part);
        if (authored && this.hasForwardedContent()) {
            throw new Error(
                "Component 'select-field' cannot combine an authored x-is='select' control with field-level option or slot content.",
            );
        }
        return authored;
    }

    hasForwardedContent() {
        return this.slots.names().some((name) => this.slots.get(name).filled());
    }

    generatedControlContent() {
        const nodes = [];
        for (const name of this.slots.names()) {
            for (const node of this.slots.get(name).all()) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    node.removeAttribute('data-isas-slot');
                    if (name !== 'default') node.setAttribute('slot', name);
                }
                nodes.push(node);
            }
        }
        return serializeNodes(nodes);
    }

    buildControlAttributes(authored, error) {
        let attributes = new AttributeBag({ size: this.size() });

        for (const [name, value] of this.attrs.entries()) {
            if (SELECT_PROPS.has(name) || SELECT_NAMESPACES.some((prefix) => name.startsWith(prefix))) {
                attributes = attributes.set(name, name === 'size' ? this.size() : value);
            }
            if (NATIVE_SHORTHANDS.has(name)) attributes = attributes.set(name, value);
        }

        const label = this.attrs.get('label');
        if (validValue(label)) attributes = attributes.set('label', label);
        for (const [name, value] of this.attrs.for('native').entries()) {
            attributes = attributes.set(`native:${name}`, value);
        }
        attributes = translateNativeLivewireAliases(this.attrs.for('select')).merge(attributes);
        if (error.active && !attributes.has('error')) {
            attributes = attributes.set('error', this.attrs.get('error'));
        }

        if (authored) attributes = AttributeBag.fromElement(authored).merge(attributes);
        attributes = attributes
            .set('x-is', authored?.getAttribute('x-is') ?? 'select')
            .set(this.constructor.controlMarker, '')
            .set('data-isas-key', 'select-field:select');
        return authored
            ? attributes
            : attributes.merge(generatedComponentAttributes('select-field:select'));
    }

    mergeAuthoredControlAttributes(element, attributes) {
        return AttributeBag.fromElement(element).merge(attributes);
    }

    resolveIds(authored) {
        const preferredBase = validValue(this.attrs.get('id'))
            ? String(this.attrs.get('id'))
            : null;
        const sources = [
            authored ? AttributeBag.fromElement(authored).for('trigger') : null,
            this.attrs.for('select').for('trigger'),
            this.attrs.for('trigger'),
        ].filter(Boolean);

        for (const source of sources) {
            for (const name of [':id', 'x-bind:id']) {
                if (validValue(source.get(name))) {
                    return this.regionIds(
                        { type: 'dynamic', value: String(source.get(name)) },
                        preferredBase,
                    );
                }
            }
            if (validValue(source.get('id'))) {
                return this.regionIds(
                    { type: 'static', value: String(source.get('id')) },
                    preferredBase,
                );
            }
        }

        const base = preferredBase ?? `x-isas-select-field-${this.fieldSequence}`;
        return this.regionIds({ type: 'static', value: `${base}-control` }, base);
    }

    applyControlAccessibility(_authored, attributes, error) {
        if (this.ids.control.type === 'dynamic') {
            attributes = attributes.set('trigger::id', this.ids.control.value);
        } else {
            attributes = attributes.set('trigger:id', this.ids.control.value);
        }

        const describedBy = [];
        if (this.parts.has('support')) describedBy.push(this.ids.support);
        if (error.active && this.parts.has('error')) describedBy.push(this.ids.error);
        if (describedBy.length) {
            attributes = attributes.set(
                'trigger:aria-describedby',
                appendTokens(attributes.get('trigger:aria-describedby'), describedBy),
            );
        }
        this.controlAttributes = attributes;
    }
}
