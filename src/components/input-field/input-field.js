import { AttributeBag } from '../../support/attribute-bag.js';
import { generatedComponentAttributes } from '../../support/generated-component.js';
import {
    appendTokens,
    FieldShell,
    validValue,
} from '../field/field-shell.js';

const INPUT_PROPS = new Set([
    'size',
    'color',
    'variant',
    'icon',
    'icon-end',
    'clearable',
    'error-icon',
]);
const INPUT_NAMESPACES = Object.freeze([
    'icon:',
    'icon-end:',
    'prepend:',
    'append:',
    'clear-action:',
    'clear-icon:',
    'error-action:',
    'error-icon:',
]);
const NATIVE_SHORTHANDS = new Set([
    'accept', 'alt', 'autocomplete', 'autofocus', 'capture', 'checked',
    'dirname', 'disabled', 'form', 'formaction', 'formenctype', 'formmethod',
    'formnovalidate', 'formtarget', 'height', 'inputmode', 'list', 'max',
    'maxlength', 'min', 'minlength', 'multiple', 'name', 'pattern',
    'placeholder', 'readonly', 'required', 'src', 'step', 'type', 'value',
    'width',
]);

export class InputField extends FieldShell {
    static fieldName = 'input-field';
    static controlName = 'input';
    static controlMarker = 'data-isas-input-field-input';
    static scopeAlias = '$input';
    static scopeProperty = 'input';
    static safeMethods = ['clear', 'showError'];

    generatedControlTag() {
        return 'label';
    }

    buildControlAttributes(authored, error) {
        let attributes = new AttributeBag({ size: this.size() });

        for (const [name, value] of this.attrs.entries()) {
            if (INPUT_PROPS.has(name) || INPUT_NAMESPACES.some((prefix) => name.startsWith(prefix))) {
                attributes = attributes.set(name, name === 'size' ? this.size() : value);
            }
            if (NATIVE_SHORTHANDS.has(name) && name !== 'size') {
                attributes = attributes.set(`native:${name}`, value);
            }
        }
        for (const [name, value] of this.attrs.for('native').entries()) {
            attributes = attributes.set(`native:${name}`, value);
        }
        attributes = this.attrs.for('input').merge(attributes);
        if (error.active) attributes = attributes.set('error', this.attrs.get('error'));

        if (authored) attributes = AttributeBag.fromElement(authored).merge(attributes);
        attributes = attributes
            .set('x-is', authored?.getAttribute('x-is') ?? 'input')
            .set(this.constructor.controlMarker, '')
            .set('data-isas-key', 'input-field:input');
        return authored
            ? attributes
            : attributes.merge(generatedComponentAttributes('input-field:input'));
    }

    mergeAuthoredControlAttributes(element, attributes) {
        return AttributeBag.fromElement(element).merge(attributes);
    }

    resolveIds(authored) {
        const preferredBase = validValue(this.attrs.get('id'))
            ? String(this.attrs.get('id'))
            : null;
        const nativePart = authored
            ? [...authored.children].find((element) => (
                element.getAttribute('x-part') === 'native'
            ))
            : null;
        const sources = [
            nativePart ? AttributeBag.fromElement(nativePart) : null,
            authored ? AttributeBag.fromElement(authored).for('native') : null,
            this.attrs.for('input').for('native'),
            this.attrs.for('native'),
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

        const base = preferredBase ?? `x-isas-input-field-${this.fieldSequence}`;
        return this.regionIds({ type: 'static', value: `${base}-control` }, base);
    }

    applyControlAccessibility(authored, attributes, error) {
        if (this.ids.control.type === 'dynamic') {
            attributes = attributes.set('native::id', this.ids.control.value);
        } else {
            attributes = attributes.set('native:id', this.ids.control.value);
        }

        const describedBy = [];
        if (this.parts.has('support')) describedBy.push(this.ids.support);
        if (error.active && this.parts.has('error')) describedBy.push(this.ids.error);
        if (describedBy.length) {
            attributes = attributes.set(
                'native:aria-describedby',
                appendTokens(attributes.get('native:aria-describedby'), describedBy),
            );
        }
        this.controlAttributes = attributes;

        if (!authored) return;
        const native = [...authored.children].find((element) => (
            element.getAttribute('x-part') === 'native'
        ));
        if (!native) return;

        if (this.ids.control.type === 'dynamic') native.setAttribute(':id', this.ids.control.value);
        else if (!native.hasAttribute('id')) native.id = this.ids.control.value;
        if (describedBy.length) {
            native.setAttribute(
                'aria-describedby',
                appendTokens(native.getAttribute('aria-describedby'), describedBy),
            );
        }
    }
}
