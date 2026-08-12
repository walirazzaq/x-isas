import { Component } from '../../component.js';
import { serializeNodes } from '../../support/html.js';
import { SelectionStore } from '../../support/selection-store.js';
import { resolveError } from '../input/input.js';
import { StyledSelectPresentation } from './styled-select-presentation.js';

let nextSelectId = 0;

export class Select extends Component {
    static attachable = true;
    static structural = true;
    static stableSlots = ['options'];

    mount() {
        const error = resolveError(this.attrs);
        this.state = this.reactive({
            values: [],
            options: [],
            selectedOptions: [],
            query: '',
            multiple: this.attrs.boolean('multiple') || this.el.hasAttribute('multiple'),
            disabled: this.attrs.boolean('disabled') || this.el.hasAttribute('disabled'),
            filter: this.resolveFilter(),
            validationVisible: error.active,
            validationMessage: error.message,
        });
        this.store = new SelectionStore(this);
        this.initialized = false;
        this.syncingHost = false;
        this.descendantObserver = null;
        this.formControl = null;
        this.formControlComponent = null;
        this.formResetCleanup = null;
        this.defaultValues = [];
        this.ownedValidityMessage = '';
        this.suppressInvalidFocus = false;
        this.presentation = this.mode === 'primary'
            ? new StyledSelectPresentation(this, ++nextSelectId)
            : null;

        this.listen(this.el, 'input', (event) => this.hostValueChanged(event));
        this.listen(this.el, 'change', (event) => this.hostValueChanged(event));
        this.startDescendantObserver();
        this.presentation?.mount();

        if (this.el.localName === 'select') {
            this.formControl = this.el;
            this.listen(this.el, 'invalid', (event) => this.formControlInvalid(event));
        }

        queueMicrotask(() => queueMicrotask(() => this.initializeSelection()));
    }

    mergeScope() {
        const scope = {
            get value() {
                const values = this.state.values;
                return this.isMultiple() ? [...values] : (values[0] ?? '');
            },
            set value(value) {
                const changed = this.store.applyValues(value, {
                    dispatch: false,
                    force: true,
                });
                if (changed) this.commitSelection();
            },
            get values() {
                return this.state.values;
            },
            get options() {
                return this.state.options;
            },
            get selectedOptions() {
                return this.state.selectedOptions;
            },
            get selectedOption() {
                return this.state.selectedOptions[0] ?? null;
            },
            get selectedIndex() {
                this.state.values;
                this.state.options;
                return this.store.selectedIndex();
            },
            set selectedIndex(value) {
                this.store.setSelectedIndex(value);
            },
            get length() {
                return this.state.options.length;
            },
            get multiple() {
                return this.isMultiple();
            },
            get disabled() {
                return this.isDisabled();
            },
            get hasSelection() {
                return this.state.values.length > 0;
            },
            get selectedCount() {
                return this.state.values.length;
            },
            get query() {
                return this.query();
            },
            set query(value) {
                this.search(value);
            },
            get filter() {
                return this.state.filter;
            },
            get formControl() {
                return this.formControlElement();
            },
            get form() {
                return this.formControlElement()?.form ?? null;
            },
            get validity() {
                return this.formControlElement()?.validity ?? null;
            },
            get valid() {
                return this.formControlElement()?.validity?.valid ?? true;
            },
            get invalid() {
                return this.state.validationVisible;
            },
            get validationMessage() {
                return this.formControlElement()?.validationMessage ?? '';
            },
            get willValidate() {
                return this.formControlElement()?.willValidate ?? false;
            },
            select: this.select,
            unselect: this.unselect,
            toggle: this.toggle,
            clear: this.clear,
            selectAll: this.selectAll,
            unselectAll: this.clear,
            isSelected: this.isSelected,
            option: this.option,
            item: this.item,
            selectedValues: this.selectedValues,
            search: this.search,
            clearSearch: this.clearSearch,
            checkValidity: this.checkValidity,
            reportValidity: this.reportValidity,
            showError: this.showError,
            setCustomValidity: this.setCustomValidity,
        };

        if (!this.presentation) return scope;
        return Object.defineProperties(
            scope,
            Object.getOwnPropertyDescriptors(this.presentation.scope()),
        );
    }

    initializeSelection() {
        if (this.initialized || !this.el.isConnected) return;
        this.initialized = true;
        this.state.multiple = this.el.hasAttribute('multiple');
        this.state.disabled = this.el.hasAttribute('disabled');

        const model = this.el._x_model;
        if (model) {
            this.store.initialize(model.get());
            this.startModelEffect();
        } else if (this.attrs.has('value')) {
            this.store.initialize(this.attrs.get('value'));
        } else {
            this.store.initializeFromSelectedOptions();
        }
        this.defaultValues = this.store.selectedValues();
        this.syncHostValue();
    }

    startModelEffect() {
        const Alpine = globalThis.Alpine;
        if (!Alpine?.effect || !this.el._x_model) return;

        const runner = Alpine.effect(() => {
            const value = this.el._x_model?.get();
            if (this.syncingHost) return;
            this.store.applyValues(value, { dispatch: false, force: true });
            this.syncHostValue();
        });
        this.onCleanup(() => Alpine.release?.(runner));
    }

    hostValueChanged(event) {
        if (event.target !== this.el || this.syncingHost || !this.initialized) return;
        this.store.applyValues(this.readHostValue(), {
            dispatch: false,
            force: true,
        });
    }

    readHostValue() {
        if (this.el.localName === 'select' && this.el.multiple) {
            return [...this.el.selectedOptions].map((option) => option.value);
        }
        return this.el.value;
    }

    syncHostValue() {
        const values = this.store.selectedValues();
        if (this.el.localName === 'select') {
            const selected = new Set(values);
            for (const option of this.el.options) option.selected = selected.has(option.value);
            if (!this.isMultiple() && values.length === 0) this.el.selectedIndex = -1;
        } else {
            this.el.value = this.isMultiple() ? values : (values[0] ?? '');
        }
        this.syncFormControl();
    }

    commitSelection() {
        this.syncingHost = true;
        this.syncHostValue();
        try {
            this.el.dispatchEvent(new Event('input', { bubbles: true }));
            this.el.dispatchEvent(new Event('change', { bubbles: true }));
        } finally {
            this.syncingHost = false;
        }
    }

    isMultiple() {
        return this.state?.multiple
            ?? (this.attrs.boolean('multiple') || this.el.hasAttribute('multiple'));
    }

    isDisabled() {
        return this.state?.disabled
            ?? (this.attrs.boolean('disabled') || this.el.hasAttribute('disabled'));
    }

    hasModelBinding() {
        return Boolean(this.el._x_model)
            || this.el.hasAttribute('x-model')
            || this.el.getAttributeNames().some((name) => (
                name === 'wire:model' || name.startsWith('wire:model.')
            ));
    }

    resolveFilter() {
        return String(this.attrs?.get('filter') ?? 'local').toLowerCase() === 'manual'
            ? 'manual'
            : 'local';
    }

    filterMode() {
        return this.state?.filter ?? this.resolveFilter();
    }

    query() {
        return String(this.state.query ?? '');
    }

    search(query = '') {
        const normalized = String(query ?? '');
        this.state.query = normalized;
        this.presentation?.syncSearchValue();
        this.el.dispatchEvent(new CustomEvent('search', {
            bubbles: true,
            composed: true,
            detail: { query: normalized },
        }));
        return normalized;
    }

    clearSearch() {
        if (this.query() === '') {
            this.presentation?.syncSearchValue();
            return '';
        }
        return this.search('');
    }

    select(value) {
        if (value?.name === 'option') return this.store.selectOption(value);
        if (value?.value !== undefined) return this.store.selectValue(value.value);
        return this.store.selectValue(value);
    }

    unselect(value) {
        if (value?.name === 'option') return this.store.unselectOption(value);
        if (value?.value !== undefined) return this.store.unselectValue(value.value);
        return this.store.unselectValue(value);
    }

    toggle(value) {
        if (value?.name === 'option') return this.store.toggleOption(value);
        if (value?.value !== undefined) return this.store.toggleValue(value.value);
        return this.store.toggleValue(value);
    }

    clear() {
        return this.store.clear();
    }

    selectAll() {
        return this.store.selectAll();
    }

    isSelected(value) {
        return this.state.values.includes(String(value?.value ?? value));
    }

    option(value) {
        return this.store.facadeFor(value);
    }

    item(index) {
        return this.store.item(index);
    }

    selectedValues() {
        return [...this.state.values];
    }

    formControlElement() {
        return this.formControl;
    }

    registerFormControl(component) {
        if (this.formControl && this.formControl !== component.el) {
            throw new Error("Component 'select' accepts only one native form control.");
        }
        this.formControl = component.el;
        this.formControlComponent = component;
        this.syncFormControl();
    }

    unregisterFormControl(component) {
        if (this.formControlComponent !== component) return;
        this.clearOwnedValidity();
        this.formControl = this.el.localName === 'select' ? this.el : null;
        this.formControlComponent = null;
        this.bindFormReset();
        this.refreshValidation();
    }

    applyFormControlValues(values) {
        const changed = this.store.applyValues(values, {
            dispatch: false,
            force: true,
        });
        if (changed) this.commitSelection();
        else this.refreshValidation();
        return changed;
    }

    syncFormControl() {
        const control = this.formControlElement();
        if (!control) {
            this.bindFormReset();
            this.refreshValidation();
            return;
        }

        if (this.formControlComponent) {
            this.formControlComponent.syncFromOwner();
        } else {
            const selected = new Set(this.selectedValues());
            control.multiple = this.isMultiple();
            for (const option of control.options) option.selected = selected.has(option.value);
            if (!control.multiple && selected.size === 0) control.selectedIndex = -1;
            this.formControlSynchronized();
        }
    }

    formControlSynchronized() {
        this.bindFormReset();
        this.syncErrorValidity();
        this.refreshValidation();
    }

    bindFormReset() {
        const form = this.formControlElement()?.form ?? null;
        if (this.formResetCleanup?.form === form) return;

        this.formResetCleanup?.();
        this.formResetCleanup = null;
        if (!form) return;

        const reset = () => queueMicrotask(() => this.resetToDefaults());
        form.addEventListener('reset', reset);
        const cleanup = () => form.removeEventListener('reset', reset);
        cleanup.form = form;
        this.formResetCleanup = cleanup;
    }

    resetToDefaults() {
        if (!this.initialized) return;
        this.store.applyValues(this.defaultValues, {
            dispatch: false,
            force: true,
        });
        this.syncHostValue();

        const value = this.isMultiple()
            ? [...this.defaultValues]
            : (this.defaultValues[0] ?? '');
        this.el._x_model?.set(value);
        this.refreshValidation({ reset: true });
    }

    syncErrorValidity() {
        const control = this.formControlElement();
        if (!control) return;

        const error = resolveError(this.attrs);
        if (error.message) {
            control.setCustomValidity(error.message);
            this.ownedValidityMessage = error.message;
        } else {
            this.clearOwnedValidity();
        }
    }

    clearOwnedValidity() {
        const control = this.formControlElement();
        if (control
            && this.ownedValidityMessage
            && control.validationMessage === this.ownedValidityMessage) {
            control.setCustomValidity('');
        }
        this.ownedValidityMessage = '';
    }

    refreshValidation({
        show = false,
        reset = false,
        focus = false,
    } = {}) {
        const control = this.formControlElement();
        const error = resolveError(this.attrs);
        const valid = control?.validity?.valid ?? true;
        const message = control?.validationMessage ?? error.message;
        const previousVisible = this.state.validationVisible;
        const previousMessage = this.state.validationMessage;

        if (reset) this.state.validationVisible = error.active;
        else if (show || error.active) this.state.validationVisible = true;
        else if (valid) this.state.validationVisible = false;
        this.state.validationMessage = this.state.validationVisible
            ? (error.message || message)
            : '';

        const changed = previousVisible !== this.state.validationVisible
            || previousMessage !== this.state.validationMessage;
        if (changed || focus) {
            this.el.dispatchEvent(new CustomEvent('x-isas:select-validation', {
                bubbles: true,
                detail: {
                    active: this.state.validationVisible,
                    message: this.state.validationMessage,
                },
            }));
        }
        if (changed || focus) this.presentation?.validationChanged({ focus });
        return changed;
    }

    formControlInvalid(event) {
        if (this.presentation) {
            event.preventDefault();
        }
        this.refreshValidation({
            show: true,
            focus: Boolean(this.presentation)
                && !this.suppressInvalidFocus
                && this.isFirstInvalidFormControl(),
        });
    }

    isFirstInvalidFormControl() {
        const control = this.formControlElement();
        const form = control?.form;
        if (!control || !form) return true;

        return [...form.elements].find((element) => (
            element.willValidate && element.validity && !element.validity.valid
        )) === control;
    }

    runValidity(method, { focus = false } = {}) {
        const control = this.formControlElement();
        if (!control) return true;
        this.suppressInvalidFocus = true;
        let valid;
        try {
            valid = control[method]();
        } finally {
            this.suppressInvalidFocus = false;
        }
        if (!valid && focus) this.presentation?.validationChanged({ focus: true });
        return valid;
    }

    checkValidity() {
        return this.runValidity('checkValidity');
    }

    reportValidity() {
        return this.runValidity('reportValidity', { focus: true });
    }

    showError() {
        return this.reportValidity();
    }

    setCustomValidity(message = '') {
        const control = this.formControlElement();
        if (!control) return false;
        control.setCustomValidity(String(message ?? ''));
        this.refreshValidation({ show: Boolean(message) });
        return true;
    }

    registerOption(option) {
        const registered = this.store.register(option);
        this.syncFormControl();
        return registered;
    }

    unregisterOption(option) {
        const unregistered = this.store.unregister(option);
        this.syncFormControl();
        return unregistered;
    }

    optionChanged(option, name, previous) {
        const result = this.store.optionChanged(option, name, previous);
        this.syncFormControl();
        return result;
    }

    optionActivated(option) {
        return this.presentation?.optionActivated(option);
    }

    focusAdjacentOption(option, direction) {
        return this.presentation?.focusAdjacentOption(option, direction) ?? false;
    }

    focusFirstVisibleOption() {
        return this.presentation?.focusFirstVisibleOption() ?? false;
    }

    focusLastVisibleOption() {
        return this.presentation?.focusLastVisibleOption() ?? false;
    }

    close() {
        return this.presentation?.close() ?? false;
    }

    attributeChanged(name) {
        if (name === 'disabled') {
            this.state.disabled = this.attrs.boolean('disabled')
                || this.el.hasAttribute('disabled');
        }
        if (name === 'multiple') {
            this.state.multiple = this.attrs.boolean('multiple')
                || this.el.hasAttribute('multiple');
        }
        if (name === 'filter') this.state.filter = this.resolveFilter();
        this.presentation?.attributeChanged(name);

        if (!this.initialized) return;
        if (name === 'value' && !this.el._x_model) {
            this.store.applyValues(this.attrs.get('value'), {
                dispatch: false,
                force: true,
            });
            this.syncHostValue();
        }
        if (name === 'multiple') {
            const changed = this.store.applyValues(this.store.selectedValues(), {
                dispatch: false,
                force: true,
            });
            this.syncHostValue();
            if (changed && this.el._x_model) this.commitSelection();
        }
        if (name === 'error' && !this.presentation) this.syncFormControl();
    }

    sourceChanged() {
        const wasMultiple = this.state.multiple;
        this.state.multiple = this.el.hasAttribute('multiple');
        this.state.disabled = this.el.hasAttribute('disabled');
        this.state.filter = this.resolveFilter();

        if (this.initialized) {
            if (!this.hasModelBinding() && this.attrs.has('value')) {
                this.store.applyValues(this.attrs.get('value'), {
                    dispatch: false,
                    force: true,
                });
            } else if (wasMultiple !== this.state.multiple) {
                const changed = this.store.applyValues(this.store.selectedValues(), {
                    dispatch: false,
                    force: true,
                });
                if (changed && this.el._x_model) this.commitSelection();
            }
            this.syncHostValue();
        }
        this.presentation?.sourceChanged();
        this.syncFormControl();
    }

    startDescendantObserver() {
        if (typeof MutationObserver === 'undefined') return;
        this.descendantObserver = new MutationObserver((mutations) => (
            this.reconcileChangedOptionOwners(mutations)
        ));
        this.descendantObserver.observe(this.el, { childList: true, subtree: true });
        this.onCleanup(() => this.descendantObserver?.disconnect());
    }

    initializedOptionsIn(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return [];
        return [node, ...node.querySelectorAll('*')]
            .map((element) => (
                this.runtime.constructor.from(element)?.componentFor('option')
            ))
            .filter(Boolean);
    }

    reconcileChangedOptionOwners(mutations) {
        const options = new Set();
        for (const { addedNodes, removedNodes } of mutations) {
            for (const node of [...addedNodes, ...removedNodes]) {
                for (const option of this.initializedOptionsIn(node)) options.add(option);
            }
        }
        for (const option of options) {
            if (option.owner('select') === option.ownerSelect()) continue;
            option.connectOwner();
        }
    }

    hostAttributes() {
        return this.presentation?.hostAttributes() ?? {};
    }

    render() {
        if (this.presentation) return this.presentation.render();
        return serializeNodes(this.source.childNodes());
    }

    destroy() {
        this.descendantObserver?.disconnect();
        this.descendantObserver = null;
        this.formResetCleanup?.();
        this.formResetCleanup = null;
        this.clearOwnedValidity();
        this.formControl = null;
        this.formControlComponent = null;
        this.presentation?.destroy();
        this.store?.disconnect();
    }
}
