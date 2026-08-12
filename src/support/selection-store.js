import { escapeHtml } from './html.js';

function unique(values) {
    const seen = new Set();

    return values.filter((value) => {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}

function sameValues(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function domOrder(left, right) {
    if (left.el === right.el) return 0;

    const position = left.el.compareDocumentPosition(right.el);
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    return 0;
}

function hasPendingBoundValue(option) {
    const bound = option.el.hasAttribute(':value')
        || option.el.hasAttribute('x-bind:value');
    if (!bound) return false;
    if (!option.el.hasAttribute('value')) return true;

    return option.optionValue() !== String(option.el.getAttribute('value') ?? '');
}

/**
 * Internal value-oriented store for the headless select/option components.
 *
 * Active options are ordered by the DOM. Selected records are ordered by the
 * model and remain alive after their option element has been detached.
 */
export class SelectionStore {
    constructor(select) {
        this.select = select;
        this.candidates = new Set();
        this.activeByValue = new Map();
        this.activeByOption = new Map();
        this.records = new Map();
        this.values = [];
        this.initialized = false;
        this.warnedDuplicateValues = new WeakMap();
    }

    disconnect() {
        for (const option of this.candidates) option._setStoreActive(false);
        this.candidates.clear();
        this.activeByValue.clear();
        this.activeByOption.clear();
        this.records.clear();
        this.values = [];
        this.syncPublicState();
    }

    normalizeValues(raw) {
        let values;

        if (Array.isArray(raw)) {
            values = raw;
        } else if (raw === null || raw === undefined || raw === '') {
            values = [];
        } else if (this.select.isMultiple() && typeof raw === 'string') {
            const value = raw.trim();

            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    const parsed = JSON.parse(value);
                    values = Array.isArray(parsed) ? parsed : [raw];
                } catch {
                    values = [raw];
                }
            } else {
                values = [raw];
            }
        } else {
            values = [raw];
        }

        const normalized = unique(values
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value)));

        return this.select.isMultiple() ? normalized : normalized.slice(0, 1);
    }

    initialize(raw) {
        this.initialized = true;
        this.applyValues(raw, { dispatch: false, force: true });
    }

    initializeFromSelectedOptions() {
        const selected = this.activeOptions()
            .filter((option) => option.hasSelectedAttribute())
            .map((option) => option.optionValue());

        this.initialize(this.select.isMultiple() ? selected : selected.slice(-1));
    }

    register(option) {
        this.candidates.add(option);
        const wasActive = this.activeByOption.has(option);
        const declaredSelected = option.hasSelectedAttribute();
        this.reconcile();

        if (this.initialized
            && !wasActive
            && this.activeByOption.has(option)
            && declaredSelected
            && !this.select.hasModelBinding()
            && !this.isSelected(option.optionValue())) {
            const next = this.select.isMultiple()
                ? [...this.values, option.optionValue()]
                : [option.optionValue()];
            this.applyValues(next, { dispatch: true, force: true });
        }

        return this.activeByOption.has(option);
    }

    unregister(option) {
        this.candidates.delete(option);
        option._setStoreActive(false);
        this.reconcile();
    }

    optionChanged(option, name, previous = {}) {
        const previousValue = previous.value;
        const wasActive = this.activeByOption.has(option);
        const wasSelected = wasActive && this.isSelected(previousValue);
        const selectedAttribute = option.hasSelectedAttribute();
        let selectedValueChanged = false;

        if (name === 'value' && wasSelected && previousValue !== option.optionValue()) {
            const next = this.values.map((value) => (
                value === previousValue ? option.optionValue() : value
            ));
            this.values = this.normalizeValues(next);
            selectedValueChanged = true;
        }

        this.reconcile();

        if (!this.initialized || !this.activeByOption.has(option)) return;

        if ((name === 'selected' || name === 'source')
            && !this.select.hasModelBinding()) {
            const selected = this.isOptionSelected(option);

            if (selectedAttribute !== selected) {
                const next = selectedAttribute
                    ? (this.select.isMultiple()
                        ? [...this.values, option.optionValue()]
                        : [option.optionValue()])
                    : this.values.filter((value) => value !== option.optionValue());

                this.applyValues(next, { dispatch: true, force: true });
                return;
            }
        }

        if (name === 'value' && selectedValueChanged) {
            this.select.commitSelection();
        }
    }

    reconcile() {
        const candidates = [...this.candidates]
            .filter((option) => option.el.isConnected)
            .filter((option) => option.ownerSelect() === this.select)
            .sort(domOrder);
        const nextByValue = new Map();
        const nextByOption = new Map();

        for (const option of candidates) {
            const value = option.optionValue();

            if (nextByValue.has(value)) {
                option._setStoreActive(false);

                if (!hasPendingBoundValue(option)
                    && this.warnedDuplicateValues.get(option) !== value) {
                    console.warn(
                        `Component 'select' requires unique option values; `
                        + `ignoring duplicate value '${value}'.`,
                    );
                    this.warnedDuplicateValues.set(option, value);
                }
                continue;
            }

            nextByValue.set(value, option);
            nextByOption.set(option, value);
            option._setStoreActive(true);
            this.warnedDuplicateValues.delete(option);
        }

        for (const option of this.activeByOption.keys()) {
            if (!nextByOption.has(option)) option._setStoreActive(false);
        }

        this.activeByValue = nextByValue;
        this.activeByOption = nextByOption;

        for (const [value, record] of this.records) {
            if (this.activeByValue.has(value)) continue;

            if (record.state.attached) record.state.attached = false;
            if (record.state.el !== null) record.state.el = null;
            record.option = null;
        }

        for (const [value, option] of this.activeByValue) {
            const record = this.record(value);
            record.option = option;
            const label = option.labelText();
            const selection = option.selectionHtml();
            const selectionCustom = option.hasCustomSelection();
            const description = option.descriptionText();
            const keywords = option.keywordsText();
            const disabled = option.isDisabled();

            if (record.state.el !== option.el) record.state.el = option.el;
            if (record.state.label !== label) record.state.label = label;
            if (record.state.selection !== selection) record.state.selection = selection;
            if (record.state.selectionCustom !== selectionCustom) {
                record.state.selectionCustom = selectionCustom;
            }
            if (record.state.description !== description) record.state.description = description;
            if (record.state.keywords !== keywords) record.state.keywords = keywords;
            if (record.state.disabled !== disabled) record.state.disabled = disabled;
            if (!record.state.attached) record.state.attached = true;
        }

        this.reconcileSelectedRecords();
        if (this.initialized) this.syncOptionAttributes();
        this.syncPublicState();
    }

    reconcileSelectedRecords() {
        const selected = new Set(this.values);

        for (const value of this.values) {
            const record = this.record(value);
            record.state.selected = true;
        }

        for (const [value, record] of [...this.records]) {
            if (selected.has(value)) continue;

            record.state.selected = false;
            if (!record.state.attached) this.records.delete(value);
        }
    }

    record(value) {
        const normalized = String(value);
        const existing = this.records.get(normalized);
        if (existing) return existing;

        const state = this.select.reactive({
            el: null,
            value: normalized,
            label: normalized,
            selection: escapeHtml(normalized),
            selectionCustom: false,
            description: '',
            keywords: '',
            selected: false,
            disabled: false,
            attached: false,
        });
        const record = {
            state,
            option: null,
            facade: null,
        };
        const store = this;

        record.facade = Object.freeze({
            get el() { return state.el; },
            get value() { return state.value; },
            get label() { return state.label; },
            get selection() { return state.selection; },
            get selectionCustom() { return state.selectionCustom; },
            get description() { return state.description; },
            get keywords() { return state.keywords; },
            get selected() { return state.selected; },
            set selected(value) {
                if (value) store.selectValue(state.value);
                else store.unselectValue(state.value);
            },
            get disabled() { return state.disabled; },
            set disabled(value) {
                if (record.option) {
                    if (value) record.option.disable();
                    else record.option.enable();
                }
            },
            get attached() { return state.attached; },
            get matchesQuery() { return store.matchesRecord(record); },
            select: () => store.selectValue(state.value),
            unselect: () => store.unselectValue(state.value),
            toggle: () => store.toggleValue(state.value),
            enable: () => record.option?.enable() ?? false,
            disable: () => record.option?.disable() ?? false,
            matches: (query) => store.matchesRecord(record, query),
        });

        this.records.set(normalized, record);
        return record;
    }

    activeOptions() {
        return [...this.activeByValue.values()];
    }

    optionFacades() {
        return this.activeOptions().map((option) => (
            this.records.get(option.optionValue()).facade
        ));
    }

    selectedFacades() {
        return this.values.map((value) => this.record(value).facade);
    }

    selectedValues() {
        return [...this.values];
    }

    isSelected(value) {
        return this.values.includes(String(value));
    }

    isOptionSelected(option) {
        const value = this.activeByOption.get(option);
        if (value === undefined) return false;
        return this.records.get(value)?.state.selected ?? false;
    }

    isActiveOption(option) {
        return this.activeByOption.has(option);
    }

    optionFor(value) {
        return this.activeByValue.get(String(value)) ?? null;
    }

    facadeFor(value) {
        return this.records.get(String(value))?.facade ?? null;
    }

    item(index) {
        const option = this.activeOptions()[Number(index)];
        return option ? this.records.get(option.optionValue()).facade : null;
    }

    selectedIndex() {
        return this.activeOptions().findIndex((option) => (
            this.isSelected(option.optionValue())
        ));
    }

    setSelectedIndex(index) {
        const normalized = Number(index);
        if (!Number.isInteger(normalized) || normalized < 0) {
            return this.clear();
        }

        const option = this.activeOptions()[normalized];
        return option ? this.selectOption(option) : false;
    }

    applyValues(raw, { dispatch = false, force = false } = {}) {
        const next = this.normalizeValues(raw);

        if (!force && this.select.isDisabled()) return false;

        const changed = !sameValues(next, this.values);
        this.values = next;
        this.reconcileSelectedRecords();
        this.syncOptionAttributes();
        this.syncPublicState();

        if (dispatch && changed) this.select.commitSelection();
        return changed;
    }

    selectOption(option) {
        if (!this.isActiveOption(option)
            || this.select.isDisabled()
            || option.isDisabled()) {
            return false;
        }

        return this.selectValue(option.optionValue());
    }

    unselectOption(option) {
        if (!this.isActiveOption(option)
            || this.select.isDisabled()
            || option.isDisabled()) {
            return false;
        }

        return this.unselectValue(option.optionValue());
    }

    toggleOption(option) {
        return this.isOptionSelected(option)
            ? this.unselectOption(option)
            : this.selectOption(option);
    }

    selectValue(value) {
        if (value === null || value === undefined || this.select.isDisabled()) return false;

        const normalized = String(value);
        const option = this.optionFor(normalized);
        const record = this.records.get(normalized);
        if (option?.isDisabled() || (!option && record?.state.disabled)) return false;
        const next = this.select.isMultiple()
            ? [...this.values, normalized]
            : [normalized];
        return this.applyValues(next, { dispatch: true });
    }

    unselectValue(value) {
        if (value === null || value === undefined || this.select.isDisabled()) return false;

        const normalized = String(value);
        const option = this.optionFor(normalized);
        const record = this.records.get(normalized);
        if (option?.isDisabled() || (!option && record?.state.disabled)) return false;

        return this.applyValues(
            this.values.filter((candidate) => candidate !== normalized),
            { dispatch: true },
        );
    }

    toggleValue(value) {
        return this.isSelected(value)
            ? this.unselectValue(value)
            : this.selectValue(value);
    }

    clear() {
        return this.applyValues([], { dispatch: true });
    }

    selectAll() {
        if (this.select.isDisabled()) return false;

        const values = this.activeOptions()
            .filter((option) => !option.isDisabled())
            .map((option) => option.optionValue());

        return this.applyValues(
            this.select.isMultiple()
                ? values
                : values.slice(0, 1),
            { dispatch: true },
        );
    }

    syncOptionAttributes() {
        for (const option of this.candidates) {
            option._syncSelectedAttribute(this.isOptionSelected(option));
        }
    }

    matchesRecord(record, query = this.select.query()) {
        const needle = String(query ?? '').trim().toLocaleLowerCase();
        if (!needle) return true;

        return [
            record.state.label,
            record.state.value,
            record.state.description,
            record.state.keywords,
        ]
            .some((value) => String(value ?? '').toLocaleLowerCase().includes(needle));
    }

    syncPublicState() {
        if (!this.select.state) return;

        const values = this.selectedValues();
        const options = this.optionFacades();
        const selectedOptions = this.selectedFacades();

        if (!sameValues(this.select.state.values, values)) {
            this.select.state.values = values;
        }
        if (!sameValues(this.select.state.options, options)) {
            this.select.state.options = options;
        }
        if (!sameValues(this.select.state.selectedOptions, selectedOptions)) {
            this.select.state.selectedOptions = selectedOptions;
        }
    }
}
