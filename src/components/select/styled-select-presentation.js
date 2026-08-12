import { generatedComponentAttributes } from '../../support/generated-component.js';
import { AttributeBag } from '../../support/attribute-bag.js';
import { escapeHtml, renderElement as element } from '../../support/html.js';

const INCOMPATIBLE_HOSTS = new Set([
    'button',
    'input',
    'menu',
    'ol',
    'option',
    'select',
    'table',
    'tbody',
    'tfoot',
    'thead',
    'tr',
    'ul',
]);

function forceAttributes(attributes, values) {
    return Object.entries(values).reduce(
        (resolved, [name, value]) => resolved.set(name, value),
        attributes,
    );
}

function sameOptions(left, right) {
    return left.length === right.length
        && left.every((option, index) => option === right[index]);
}

export class StyledSelectPresentation {
    constructor(select, id) {
        this.select = select;
        this.overlayId = select.el.id
            ? `${select.el.id}-overlay`
            : `x-isas-select-${id}-overlay`;
        this.titleId = `${this.overlayId}-title`;
        this.controlId = `${this.overlayId}-control`;
        this.errorId = `${this.overlayId}-error`;
        this.overlayBinding = null;
        this.triggerBinding = null;
        this.searchBinding = null;
        this.warnedHost = false;

        select.state.open = false;
        select.state.presentation = this.initialPresentation();
        select.state.visibleSelectedOptions = [];
        select.state.hiddenSelectedCount = 0;
    }

    mount() {
        this.warnIncompatibleHost();
        this.select.listen(this.select.el, 'click', (event) => {
            if (!event.target.closest?.(
                '[data-isas-select-close], [data-isas-select-done]',
            )) return;
            event.preventDefault();
            this.select.close();
        });

        const effect = globalThis.Alpine.effect(() => {
            const selected = this.select.state.selectedOptions;
            selected.map((option) => (
                `${option.value}:${option.selection}:${option.selectionCustom}`
            )).join('|');
            queueMicrotask(() => {
                if (!this.select.el.isConnected) return;
                this.syncSelectionDerived();
                if (!this.select.slots.get('selection').filled()) {
                    this.select.requestRender();
                }
            });
        });
        this.select.onCleanup(() => globalThis.Alpine.release?.(effect));
    }

    initialPresentation() {
        const mode = String(this.select.attrs.get('mode') ?? 'adaptive').toLowerCase();
        return mode === 'dialog' ? 'dialog' : 'dropdown';
    }

    scope() {
        const select = this.select;
        return Object.defineProperties({}, {
            visibleSelectedOptions: {
                enumerable: true,
                get: () => select.state.visibleSelectedOptions,
            },
            hiddenSelectedCount: {
                enumerable: true,
                get: () => select.state.hiddenSelectedCount,
            },
            open: {
                enumerable: true,
                get: () => select.state.open,
                set: (value) => {
                    if (value) this.show();
                    else this.close();
                },
            },
            presentation: {
                enumerable: true,
                get: () => select.state.presentation,
            },
            show: { enumerable: true, value: () => this.show() },
            hide: { enumerable: true, value: () => this.hide() },
            close: { enumerable: true, value: () => this.close() },
            toggleOverlay: { enumerable: true, value: () => this.toggleOverlay() },
        });
    }

    hostAttributes() {
        return {
            'data-isas-select': '',
            'data-open': this.select.state.open || undefined,
            'data-presentation': this.select.state.presentation,
            'data-disabled': this.select.isDisabled() || undefined,
            'data-multiple': this.select.isMultiple() || undefined,
            'data-selection-capped': this.maxSelectionShown() !== null || undefined,
            'data-required': this.isRequired() || undefined,
            'data-invalid': this.select.state.validationVisible || undefined,
        };
    }

    validateOptionsRegion() {
        const options = this.select.slots.get('options').all()
            .filter((node) => node.nodeType === Node.ELEMENT_NODE);
        if (options.length > 1) {
            throw new Error(
                "Component 'select' accepts exactly one top-level element with slot='options'.",
            );
        }
        if (options.length === 1 && this.select.slots.get('default').filled()) {
            throw new Error(
                "Component 'select' cannot mix slot='options' with default-slot option content.",
            );
        }
    }

    render() {
        this.validateOptionsRegion();
        this.syncSelectionDerived();
        const formControlAttributes = this.formControlAttributes();
        const html = [
            this.renderFormControl(formControlAttributes),
            this.renderTrigger(formControlAttributes.boolean('required')),
            this.renderError(),
            this.renderOverlay(),
        ].join('');
        this.queueRuntimeSync();
        return html;
    }

    formControlAttributes() {
        const defaults = {};
        for (const name of ['name', 'required', 'form', 'disabled', 'autocomplete']) {
            if (this.select.el.hasAttribute(name)) {
                defaults[name] = this.select.el.getAttribute(name);
            }
        }

        const native = this.select.attrs.for('native').merge(defaults);
        const controlId = native.get('id') ?? this.controlId;
        return native
            .remove(
                'x-as',
                'multiple',
                'hidden',
                'tabindex',
                'aria-hidden',
                'data-isas-select-control',
                'data-isas-generated',
            )
            .set('id', controlId)
            .set('x-as', 'select-control')
            .set('required', native.boolean('required'))
            .set('disabled', native.boolean('disabled'))
            .set('multiple', this.select.isMultiple())
            .set('hidden', true)
            .set('tabindex', '-1')
            .set('aria-hidden', 'true')
            .set('data-isas-select-control', '')
            .merge(generatedComponentAttributes('select:form-control'));
    }

    renderFormControl(attributes = this.formControlAttributes()) {
        return element('select', attributes);
    }

    isRequired() {
        return this.formControlAttributes().boolean('required');
    }

    triggerDescribedBy() {
        const values = String(this.select.attrs.for('trigger').get('aria-describedby') ?? '')
            .split(/\s+/)
            .filter(Boolean);
        if (this.select.state.validationVisible && !this.externalValidation()) {
            values.push(this.errorId);
        }
        return [...new Set(values)].join(' ') || undefined;
    }

    externalValidation() {
        return this.select.attrs.has('data-isas-select-field-select');
    }

    renderTrigger(required = this.formControlAttributes().boolean('required')) {
        const validation = {
            'aria-required': required ? 'true' : undefined,
            'aria-invalid': this.select.state.validationVisible ? 'true' : undefined,
            'aria-describedby': this.triggerDescribedBy(),
        };
        let attributes = this.select.attrs.for('trigger').merge({
            type: 'button',
            disabled: this.select.isDisabled(),
            'data-isas-select-trigger': '',
            'aria-controls': this.overlayId,
            'aria-expanded': this.select.state.open ? 'true' : 'false',
            'aria-haspopup': this.select.state.presentation === 'dialog'
                ? 'dialog'
                : 'listbox',
            ...validation,
        });
        attributes = forceAttributes(attributes, validation);

        return element(
            'button',
            attributes,
            `${this.renderPrepend()}${this.renderSelection()}${this.renderAppend()}`,
        );
    }

    renderError() {
        if (this.externalValidation()) return '';

        const owned = {
            id: this.errorId,
            hidden: !this.select.state.validationVisible,
            'aria-live': 'polite',
            'data-isas-select-error': '',
        };
        const attributes = forceAttributes(
            this.select.attrs.for('error').merge(owned),
            owned,
        );

        const slot = this.select.slots.get('error');
        if (slot.filled()) return slot.attrs(attributes).html();

        return element(
            'p',
            attributes,
            escapeHtml(this.select.state.validationMessage),
        );
    }

    renderPrepend() {
        if (this.select.slots.get('prepend').filled()) {
            return element(
                'span',
                this.select.attrs.for('prepend'),
                this.select.slots.get('prepend').html(),
            );
        }

        const icon = this.select.attrs.get('icon');
        const prefix = this.select.attrs.get('prefix');
        if (icon) return element('span', this.select.attrs.for('prepend').class(icon));
        if (prefix !== null && prefix !== undefined && String(prefix) !== '') {
            return element('span', this.select.attrs.for('prepend'), escapeHtml(prefix));
        }
        return '';
    }

    renderAppend() {
        if (this.select.slots.get('append').filled()) {
            return element(
                'span',
                this.select.attrs.for('append'),
                this.select.slots.get('append').html(),
            );
        }

        const pieces = [];
        const suffix = this.select.attrs.get('suffix');
        const icon = this.select.attrs.get('icon-end');
        if (suffix !== null && suffix !== undefined && String(suffix) !== '') {
            pieces.push(element('span', this.select.attrs.for('suffix'), escapeHtml(suffix)));
        }
        if (icon) pieces.push(element('span', this.select.attrs.for('icon-end').class(icon)));
        pieces.push(element('span', this.select.attrs.for('chevron')));
        return element('span', this.select.attrs.for('append'), pieces.join(''));
    }

    renderSelection() {
        if (this.select.slots.get('selection').filled()) {
            return element(
                'span',
                this.select.attrs.for('selection').merge({
                    'data-isas-select-selection': '',
                    'data-isas-select-selection-viewport': '',
                    'data-custom-selection': '',
                    'data-isas-slot-owns-children': '',
                }),
                this.select.slots.get('selection').html(),
            );
        }

        const items = this.select.state.visibleSelectedOptions
            .map((option) => this.renderSelectionItem(option))
            .join('');
        const more = this.renderMore();
        const placeholder = this.select.state.selectedOptions.length === 0
            ? element(
                'span',
                this.select.attrs.for('placeholder'),
                escapeHtml(this.placeholderText()),
            )
            : '';

        return element(
            'span',
            this.select.attrs.for('selection').merge({
                'data-isas-select-selection': '',
                'data-isas-select-selection-viewport': '',
            }),
            element(
                'span',
                this.select.attrs.for('selection-items').merge({
                    'data-isas-select-selection-items': '',
                }),
                `${items}${more}`,
            ) + placeholder,
        );
    }

    renderSelectionItem(option) {
        const base = this.select.attrs.for('selection-item');
        const shell = this.select.attrs.for(
            this.select.isMultiple() ? 'chip' : 'single-selection',
        );
        const attributes = (option.selectionCustom ? base : shell.merge(base)).merge({
            'data-isas-select-selection-item': '',
            'data-selection-custom': option.selectionCustom || undefined,
            'data-isas-key': `select-selection:${option.value}`,
            'x-data': `{ $option: $select.option(${JSON.stringify(String(option.value))}) }`,
        });

        return element('span', attributes, option.selection);
    }

    renderMore() {
        const hidden = this.select.state.hiddenSelectedCount;
        if (hidden === 0) return '';

        const attributes = this.select.attrs.for('more').merge({
            'data-isas-select-more': '',
            'data-hidden-count': String(hidden),
            'aria-label': `${hidden} more selected`,
        });
        const slot = this.select.slots.get('more');
        if (slot.filled()) return slot.attrs(attributes).html();
        return element('span', attributes, `+${hidden}`);
    }

    renderOverlay() {
        let overlayAttrs = this.select.attrs.for('overlay').merge({
            'x-is': 'overlay',
            id: this.overlayId,
            mode: this.select.attrs.get('mode', 'adaptive'),
            breakpoint: this.select.attrs.get('breakpoint'),
            closedby: this.select.attrs.get('closedby', 'any'),
            'aria-labelledby': this.titleId,
            ...generatedComponentAttributes('select:overlay'),
        });
        if (overlayAttrs.get('breakpoint') === null) {
            overlayAttrs = overlayAttrs.remove('breakpoint');
        }

        const content = element(
            'div',
            this.select.attrs.for('panel').merge({ 'x-part': 'content' }),
            `${this.renderDialogHeader()}${this.renderSearch()}${this.renderListbox()}${this.renderDialogFooter()}`,
        );
        return element('dialog', overlayAttrs, content);
    }

    internalAttributes(name) {
        return this.select.generatedPartAttributes(name) ?? new AttributeBag();
    }

    renderDialogHeader() {
        const title = element(
            'div',
            this.internalAttributes('_dialog-title').merge({ id: this.titleId }),
            escapeHtml(this.dialogTitleText()),
        );
        const close = element(
            'button',
            this.internalAttributes('_dialog-close').merge({
                type: 'button',
                'aria-label': 'Close select',
                'data-isas-select-close': '',
            }),
            element('span', this.internalAttributes('_dialog-close-icon')),
        );
        return element(
            'header',
            this.internalAttributes('_dialog-header').merge({
                'data-isas-select-dialog-only': '',
                hidden: this.select.state.presentation !== 'dialog',
            }),
            `${title}${close}`,
        );
    }

    renderSearch() {
        if (!this.select.attrs.boolean('searchable')
            && !this.select.slots.get('search').filled()) return '';

        const content = this.select.slots.get('search').filled()
            ? this.select.slots.get('search').html()
            : element(
                'label',
                this.select.attrs.for('search').merge({
                    'x-is': 'input',
                    icon: 'i-tabler-search',
                    'native:type': 'search',
                    'native:autocomplete': 'off',
                    'native:placeholder': 'Search options',
                    'native:data-isas-select-search': '',
                    ...generatedComponentAttributes('select:search'),
                }),
            );

        return element(
            'div',
            this.select.attrs.for('search-wrapper').merge({
                'data-isas-select-search-wrapper': '',
            }),
            content,
        );
    }

    renderListbox() {
        const stable = this.select.slots.get('options');
        const options = stable.filled()
            ? stable.attrs(this.select.attrs.for('options')).html()
            : this.select.slots.get('default').html();
        const empty = this.select.slots.get('empty').filled()
            ? this.select.slots.get('empty').html()
            : 'No options found';
        const emptyElement = element(
            'div',
            this.select.attrs.for('empty').merge({
                'x-show': '$select.options.length === 0 || ($select.filter === "local" && !$select.options.some(option => option.matchesQuery))',
            }),
            empty,
        );

        return element(
            'div',
            this.select.attrs.for('listbox').merge({
                role: 'listbox',
                tabindex: '-1',
                'aria-multiselectable': this.select.isMultiple() ? 'true' : 'false',
                'data-isas-select-listbox': '',
            }),
            `${options}${emptyElement}`,
        );
    }

    renderDialogFooter() {
        if (!this.select.isMultiple()) return '';
        const done = element(
            'button',
            this.internalAttributes('_done').merge({
                type: 'button',
                'data-isas-select-done': '',
            }),
            'Done',
        );
        return element(
            'footer',
            this.internalAttributes('_dialog-footer').merge({
                'data-isas-select-dialog-only': '',
                hidden: this.select.state.presentation !== 'dialog',
            }),
            done,
        );
    }

    placeholderText() {
        return String(this.select.attrs.get('placeholder') ?? 'Select an option');
    }

    dialogTitleText() {
        return String(
            this.select.attrs.get('label')
            ?? this.select.attrs.get('placeholder')
            ?? 'Select options',
        );
    }

    maxSelectionShown() {
        if (!this.select.isMultiple()) return null;
        if (!this.select.attrs.has('max-selection-shown')) return null;
        const value = Number(this.select.attrs.get('max-selection-shown'));
        return Number.isInteger(value) && value >= 0 ? value : null;
    }

    syncSelectionDerived() {
        const selected = this.select.state.selectedOptions;
        const max = this.maxSelectionShown();
        const visible = max === null ? selected : selected.slice(0, max);
        const hidden = selected.length - visible.length;

        if (!sameOptions(this.select.state.visibleSelectedOptions, visible)) {
            this.select.state.visibleSelectedOptions = visible;
        }
        if (this.select.state.hiddenSelectedCount !== hidden) {
            this.select.state.hiddenSelectedCount = hidden;
        }
    }

    queueRuntimeSync() {
        queueMicrotask(() => queueMicrotask(() => {
            if (this.select.el.isConnected) this.syncRuntime();
        }));
    }

    syncRuntime() {
        this.bindOverlay();
        this.bindTrigger();
        this.bindSearch();
        this.syncPresentation();
        this.syncSearchValue();
        this.select.syncFormControl();
    }

    overlayElement() {
        return this.select.el.querySelector(`#${CSS.escape(this.overlayId)}`);
    }

    overlayComponent() {
        const overlay = this.overlayElement();
        return overlay
            ? this.select.runtime.constructor.from(overlay)?.componentFor('overlay')
            : null;
    }

    triggerElement() {
        return this.select.el.querySelector('[data-isas-select-trigger]');
    }

    searchInput() {
        const wrapper = this.select.el.querySelector('[data-isas-select-search-wrapper]');
        return wrapper?.querySelector('[data-isas-select-search], input') ?? null;
    }

    bindOverlay() {
        const overlay = this.overlayElement();
        if (this.overlayBinding?.element === overlay) return;
        this.overlayBinding?.cleanup();
        this.overlayBinding = null;
        if (!overlay) return;

        const sync = () => {
            const wasOpen = this.select.state.open;
            this.syncPresentation();
            if (wasOpen && !this.select.state.open) this.select.clearSearch();
            if (!wasOpen && this.select.state.open) {
                queueMicrotask(() => this.focusInitialOption());
            }
        };
        overlay.addEventListener('toggle', sync);
        overlay.addEventListener('close', sync);
        overlay.addEventListener('presentationchange', sync);
        this.overlayBinding = {
            element: overlay,
            cleanup: () => {
                overlay.removeEventListener('toggle', sync);
                overlay.removeEventListener('close', sync);
                overlay.removeEventListener('presentationchange', sync);
            },
        };
    }

    bindTrigger() {
        const trigger = this.triggerElement();
        if (this.triggerBinding?.element === trigger) return;
        this.triggerBinding?.cleanup();
        this.triggerBinding = null;
        if (!trigger) return;

        const keydown = (event) => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            this.show();
            queueMicrotask(() => (
                event.key === 'ArrowUp'
                    ? this.focusLastVisibleOption()
                    : this.focusInitialOption()
            ));
        };
        const click = (event) => {
            if (this.select.isDisabled() || event.defaultPrevented) return;
            this.toggleOverlay();
        };
        trigger.addEventListener('click', click);
        trigger.addEventListener('keydown', keydown);
        this.triggerBinding = {
            element: trigger,
            cleanup: () => {
                trigger.removeEventListener('click', click);
                trigger.removeEventListener('keydown', keydown);
            },
        };
    }

    bindSearch() {
        const input = this.searchInput();
        if ((this.searchBinding?.element ?? null) === input) return;
        this.searchBinding?.cleanup();
        this.searchBinding = null;
        if (!input) return;

        const update = (event) => {
            this.select.search(input.value);
            event.stopPropagation();
        };
        const keydown = (event) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.focusFirstVisibleOption();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                if (this.select.query()) this.select.clearSearch();
                else this.close();
            }
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        input.addEventListener('keydown', keydown);
        this.searchBinding = {
            element: input,
            cleanup: () => {
                input.removeEventListener('input', update);
                input.removeEventListener('change', update);
                input.removeEventListener('keydown', keydown);
            },
        };
    }

    syncSearchValue() {
        const input = this.searchInput();
        if (input && input.value !== this.select.query()) input.value = this.select.query();
    }

    syncPresentation() {
        const overlay = this.overlayComponent();
        if (!overlay) return;
        this.select.state.open = Boolean(overlay.controller?.state.open);
        this.select.state.presentation = overlay.presentation;

        const trigger = this.triggerElement();
        if (trigger) {
            trigger.setAttribute('aria-controls', this.overlayId);
            trigger.setAttribute('aria-expanded', this.select.state.open ? 'true' : 'false');
            trigger.setAttribute(
                'aria-haspopup',
                this.select.state.presentation === 'dialog' ? 'dialog' : 'listbox',
            );
        }
        for (const node of this.select.el.querySelectorAll(
            '[data-isas-select-dialog-only]',
        )) {
            node.hidden = this.select.state.presentation !== 'dialog';
        }
    }

    visibleOptions() {
        return this.select.store.activeOptions().filter((option) => (
            !option.isDisabled()
            && (this.select.filterMode() !== 'local' || option.matches())
            && !option.el.hidden
        ));
    }

    focusOption(option) {
        if (!option?.el?.focus) return false;
        option.el.focus({ preventScroll: true });
        option.el.scrollIntoView?.({ block: 'nearest' });
        return true;
    }

    focusInitialOption() {
        const search = this.searchInput();
        if (search) {
            search.focus({ preventScroll: true });
            return true;
        }
        const selected = this.select.store.activeOptions().find((option) => (
            this.select.store.isOptionSelected(option)
            && this.visibleOptions().includes(option)
        ));
        return this.focusOption(selected ?? this.visibleOptions()[0] ?? null);
    }

    focusAdjacentOption(current, direction = 1) {
        const options = this.visibleOptions();
        if (!options.length) return false;
        const index = options.indexOf(current);
        const next = index === -1
            ? (direction > 0 ? 0 : options.length - 1)
            : Math.max(0, Math.min(options.length - 1, index + direction));
        return this.focusOption(options[next]);
    }

    focusFirstVisibleOption() {
        return this.focusOption(this.visibleOptions()[0] ?? null);
    }

    focusLastVisibleOption() {
        return this.focusOption(this.visibleOptions().at(-1) ?? null);
    }

    closeOnSelect() {
        if (this.select.attrs.has('close-on-select')) {
            return this.select.attrs.boolean('close-on-select');
        }
        return !this.select.isMultiple();
    }

    optionActivated() {
        if (this.closeOnSelect()) this.select.close();
    }

    show() {
        return this.overlayComponent()?.show({ source: this.triggerElement() }) ?? false;
    }

    hide() {
        return this.close();
    }

    close() {
        return this.overlayComponent()?.close() ?? false;
    }

    toggleOverlay() {
        return this.overlayComponent()?.toggle({ source: this.triggerElement() }) ?? false;
    }

    attributeChanged(name) {
        if (['max-selection-shown', 'multiple'].includes(name)) {
            this.syncSelectionDerived();
        }
        if (['mode', 'breakpoint', 'closedby'].includes(name)) this.queueRuntimeSync();
    }

    sourceChanged() {
        this.syncSelectionDerived();
    }

    validationChanged({ focus = false } = {}) {
        this.select.requestRender();
        if (!focus) return;

        queueMicrotask(() => queueMicrotask(() => {
            if (!this.select.el.isConnected) return;
            this.triggerElement()?.focus({ preventScroll: false });
        }));
    }

    destroy() {
        this.overlayBinding?.cleanup();
        this.triggerBinding?.cleanup();
        this.searchBinding?.cleanup();
    }

    warnIncompatibleHost() {
        if (this.warnedHost || !INCOMPATIBLE_HOSTS.has(this.select.el.localName)) return;
        this.warnedHost = true;
        console.warn(
            `Component 'select' composes a trigger and overlay; `
            + `<${this.select.el.localName}> is not a compatible styled-select host. `
            + 'Use a flow container such as <div>.',
        );
    }
}
