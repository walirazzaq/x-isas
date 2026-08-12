import { Component } from '../../component.js';

/**
 * Shallow native form control for a headless or styled Select owner.
 *
 * The owner remains authoritative for selection state. This attachment mirrors
 * that state into a real <select> so browser forms, FormData, reset, and
 * constraint validation keep their native semantics.
 */
export class SelectControl extends Component {
    static attachable = true;
    static scoped = false;

    mount() {
        if (this.el.localName !== 'select') {
            throw new Error("Component 'select-control' requires a native <select> host.");
        }
        const authoredOptions = [...this.el.querySelectorAll('option')].filter((option) => (
            option.getAttribute('data-isas-generated') !== 'select-control:option'
        ));
        if (authoredOptions.length > 0) {
            throw new Error(
                "Component 'select-control' owns its native options; "
                + "author Select options on the parent Select instead.",
            );
        }

        this.selectOwner = this.owner('select');
        if (!this.selectOwner) {
            throw new Error("Component 'select-control' requires an ancestor component 'select'.");
        }

        this.syncingOwner = false;
        this.selectOwner.registerFormControl(this);

        this.listen(this.el, 'input', () => this.controlValueChanged());
        this.listen(this.el, 'change', () => this.controlValueChanged());
        this.listen(this.el, 'invalid', (event) => {
            this.selectOwner?.formControlInvalid(event);
        });

        queueMicrotask(() => this.syncFromOwner());
    }

    selectedValues() {
        return this.el.multiple
            ? [...this.el.selectedOptions].map((option) => option.value)
            : (this.el.selectedIndex === -1 ? [] : [this.el.value]);
    }

    controlValueChanged() {
        if (this.syncingOwner || !this.selectOwner) return;
        this.selectOwner.applyFormControlValues(this.selectedValues());
    }

    optionDefinitions() {
        if (!this.selectOwner) return [];

        const definitions = this.selectOwner.store.activeOptions().map((option) => ({
            value: option.optionValue(),
            label: option.labelText(),
            disabled: option.isDisabled(),
        }));
        const known = new Set(definitions.map(({ value }) => value));

        for (const option of this.selectOwner.state.selectedOptions) {
            if (known.has(option.value)) continue;
            known.add(option.value);
            definitions.push({
                value: option.value,
                label: option.label || option.value,
                disabled: option.disabled,
            });
        }

        return definitions;
    }

    syncOptions() {
        const definitions = this.optionDefinitions();
        const options = [...this.el.options];
        const synchronized = options.length === definitions.length
            && definitions.every((definition, index) => {
                const option = options[index];
                return option.value === definition.value
                    && option.textContent === definition.label
                    && option.disabled === Boolean(definition.disabled);
            });
        if (synchronized) return;

        const fragment = document.createDocumentFragment();

        for (const definition of definitions) {
            const option = document.createElement('option');
            option.value = definition.value;
            option.textContent = definition.label;
            option.disabled = Boolean(definition.disabled);
            option.setAttribute('data-isas-generated', 'select-control:option');
            fragment.append(option);
        }

        this.el.replaceChildren(fragment);
    }

    syncFromOwner() {
        if (!this.selectOwner || !this.el.isConnected) return;

        this.syncingOwner = true;
        try {
            this.runtime.mutateHost((element) => {
                element.toggleAttribute('multiple', this.selectOwner.isMultiple());
            });
            this.syncOptions();

            const selected = new Set(this.selectOwner.selectedValues());
            for (const option of this.el.options) {
                option.selected = selected.has(option.value);
            }
            if (!this.el.multiple && selected.size === 0) this.el.selectedIndex = -1;
        } finally {
            this.syncingOwner = false;
        }

        this.selectOwner.formControlSynchronized();
    }

    attributeChanged() {
        this.selectOwner?.formControlSynchronized();
    }

    sourceChanged() {
        this.syncFromOwner();
    }

    destroy() {
        this.selectOwner?.unregisterFormControl(this);
        this.selectOwner = null;
    }
}
