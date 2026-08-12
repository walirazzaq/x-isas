import { generatedComponentAttributes } from '../../support/generated-component.js';
import { escapeHtml, renderElement as element } from '../../support/html.js';
import { prepareAccessories } from '../../support/render-accessories.js';
import { Calendar } from './calendar.js';

let nextDatePickerId = 0;

export class DatePicker extends Calendar {
    static stableSlots = ['day', 'value', 'prepend', 'append'];

    mount() {
        this.presentationLayout = null;
        this.pickerId = this.el.id || `x-isas-date-picker-${++nextDatePickerId}`;
        this.overlayId = `${this.pickerId}-overlay`;
        this.titleId = `${this.overlayId}-title`;
        this.overlayBinding = null;
        super.mount();
    }

    layout() {
        if (this.attrs?.has('layout')) return super.layout();
        if (this.presentationLayout) return this.presentationLayout;
        return String(this.attrs?.get('mode') ?? 'adaptive').toLowerCase() === 'dialog'
            ? 'fill'
            : 'fit';
    }

    mergeScope() {
        return Object.defineProperties(super.mergeScope(), {
            open: {
                enumerable: true,
                get: () => Boolean(this.overlayComponent()?.controller?.state.open),
                set: (value) => (value ? this.show() : this.close()),
            },
            show: { enumerable: true, value: () => this.show() },
            close: { enumerable: true, value: () => this.close() },
            toggleOverlay: { enumerable: true, value: () => this.toggleOverlay() },
            clear: { enumerable: true, value: () => this.clear() },
        });
    }

    prepareRender() {
        prepareAccessories(this.attrs, this.slots);
        return super.prepareRender();
    }

    hostAttributes() {
        return {
            ...super.hostAttributes(),
            'data-isas-date-picker': '',
        };
    }

    renderTriggerValue() {
        const hasValue = Boolean(this.state.value && this.view.displayValue);
        const label = hasValue
            ? this.view.displayValue
            : String(this.attrs.get('placeholder') ?? 'Choose a date');
        const value = hasValue && this.slots.get('value').filled()
            ? element('span', this.attrs.for('value').merge({
                'data-isas-date-picker-value': '',
                'data-custom-value': '',
                'data-isas-slot-owns-children': '',
            }), this.slots.get('value').html())
            : element(
                'span',
                this.attrs.for(hasValue ? 'value' : 'placeholder').merge(
                    hasValue ? { 'data-isas-date-picker-value': '' } : {},
                ),
                escapeHtml(label),
            );
        return { hasValue, label, value };
    }

    renderTrigger() {
        const { label, value } = this.renderTriggerValue();
        return element('button', this.attrs.for('trigger').merge({
            type: 'button',
            disabled: this.isDisabled(),
            'aria-label': label,
            'aria-invalid': this.state.validationVisible ? 'true' : undefined,
            'aria-required': this.attrs.boolean('required') ? 'true' : undefined,
            'x-as': 'overlay-trigger',
            'controls-overlay': this.overlayId,
            'data-isas-date-picker-trigger': '',
            ...generatedComponentAttributes('date-picker:trigger', { content: 'morph' }),
        }), value);
    }

    renderPrepend() {
        if (!this.slots.get('prepend').filled()) return '';
        return element('span', this.attrs.for('prepend').merge({
            'data-isas-date-picker-prepend': '',
        }), this.slots.get('prepend').html());
    }

    renderAppend() {
        const content = this.slots.get('append').filled()
            ? this.slots.get('append').html()
            : element('span', this.attrs.for('trigger-icon').merge({
                'aria-hidden': 'true',
            }));
        return element('span', this.attrs.for('append').merge({
            'data-isas-date-picker-append': '',
        }), content);
    }

    renderClearAction() {
        if (!this.attrs.boolean('clearable') || !this.state.value) return '';
        return element('button', this.attrs.for('clear-action').merge({
            type: 'button',
            disabled: this.isDisabled() || this.isReadOnly(),
            'aria-label': 'Clear date selection',
            'data-isas-date-picker-clear': '',
        }), element('span', this.attrs.for('clear-icon').merge({
            'aria-hidden': 'true',
        })));
    }

    renderTriggerShell() {
        return element('div', this.attrs.for('trigger-shell').merge({
            disabled: this.isDisabled() || undefined,
            'data-readonly': this.isReadOnly() || undefined,
            'data-isas-date-picker-trigger-shell': '',
        }), [
            this.renderPrepend(),
            this.renderTrigger(),
            this.renderAppend(),
            this.renderClearAction(),
        ].join(''));
    }

    renderOverlay() {
        let attributes = this.attrs.for('overlay').merge({
            'x-is': 'overlay',
            id: this.overlayId,
            mode: this.attrs.get('mode', 'adaptive'),
            breakpoint: this.attrs.get('breakpoint') ?? undefined,
            closedby: this.attrs.get('closedby', 'any'),
            'aria-labelledby': this.titleId,
            class: [
                this.layout() === 'fit' ? 'w-fit' : '',
                'max-w-[calc(100vw-1rem)] data-[isas-presentation=dialog]:w-auto',
            ],
            ...generatedComponentAttributes('date-picker:overlay'),
        });
        const presets = this.slots.get('default').filled()
            ? element('div', this.attrs.for('presets').merge({ 'data-isas-date-picker-presets': '' }), this.slots.get('default').html())
            : '';
        const title = element('header', this.attrs.for('dialog-header').merge({
            'data-isas-date-picker-dialog-only': '',
        }), [
            element('strong', this.attrs.for('dialog-title').merge({ id: this.titleId }), escapeHtml(
                this.attrs.get('label') ?? this.attrs.get('placeholder') ?? 'Choose a date',
            )),
            element('button', this.attrs.for('dialog-close').merge({
                type: 'button',
                'data-isas-date-picker-close': '',
                'aria-label': 'Close date picker',
            }), '×'),
        ].join(''));
        const panel = element('div', this.attrs.for('panel').merge({ 'x-part': 'content' }), `${title}${presets}${this.renderCalendarContent()}`);
        return element('dialog', attributes, panel);
    }

    render() {
        const html = `${this.renderFormControl()}${this.renderTriggerShell()}${this.renderError()}${this.renderOverlay()}`;
        this.queueDriverBind();
        return html;
    }

    afterDriverBind() {
        const overlay = this.el.querySelector(`#${CSS.escape(this.overlayId)}`);
        if (this.overlayBinding?.element === overlay) return;
        this.overlayBinding?.cleanup();
        this.overlayBinding = null;
        if (!overlay) return;
        const synchronize = () => {
            const component = this.overlayComponent();
            const open = Boolean(component?.controller?.state.open);
            if (!open) this.cancelDraft();
            else queueMicrotask(() => component.controller.startPositioning());
            const dialog = component?.presentation === 'dialog';
            for (const header of this.el.querySelectorAll('[data-isas-date-picker-dialog-only]')) {
                header.hidden = !dialog;
            }
            if (!this.attrs.has('layout')) {
                const layout = dialog ? 'fill' : 'fit';
                if (layout !== this.presentationLayout) {
                    this.presentationLayout = layout;
                    this.requestRender();
                }
            }
        };
        overlay.addEventListener('toggle', synchronize);
        overlay.addEventListener('close', synchronize);
        overlay.addEventListener('presentationchange', synchronize);
        const click = (event) => {
            if (event.target.closest?.('[data-isas-date-picker-close]')) {
                event.preventDefault();
                this.close();
                return;
            }
            if (event.target.closest?.('[data-isas-date-picker-clear]')) {
                event.preventDefault();
                if (this.clear()) {
                    queueMicrotask(() => queueMicrotask(() => {
                        this.el.querySelector('[data-isas-date-picker-trigger]')?.focus();
                    }));
                }
                return;
            }
            const shell = event.target.closest?.('[data-isas-date-picker-trigger-shell]');
            if (!shell || event.target.closest?.('[data-isas-date-picker-trigger]')) return;
            const interactive = event.target.closest?.([
                'a', 'button', 'input', 'select', 'textarea', 'summary',
                '[contenteditable="true"]', '[role="button"]', '[role="link"]',
                '[tabindex]:not([tabindex="-1"])',
            ].join(','));
            if (interactive && interactive !== shell) return;
            event.preventDefault();
            this.show();
        };
        this.el.addEventListener('click', click);
        this.overlayBinding = {
            element: overlay,
            cleanup: () => {
                overlay.removeEventListener('toggle', synchronize);
                overlay.removeEventListener('close', synchronize);
                overlay.removeEventListener('presentationchange', synchronize);
                this.el.removeEventListener('click', click);
            },
        };
        synchronize();
        // Calendar focus/hover transitions morph the parent light DOM. Ask the
        // independently owned Overlay to refresh Floating UI after that morph
        // so a tall calendar never falls back to its document-flow position.
        this.overlayComponent()?.controller?.startPositioning();
    }

    overlayComponent() {
        const element = this.el.querySelector(`#${CSS.escape(this.overlayId)}`);
        return element ? this.runtime.constructor.from(element)?.componentFor('overlay') : null;
    }

    show() {
        return this.overlayComponent()?.show({ source: this.el.querySelector('[data-isas-date-picker-trigger]') }) ?? false;
    }

    close() {
        const result = this.overlayComponent()?.close() ?? false;
        this.cancelDraft();
        return result;
    }

    toggleOverlay() {
        return this.overlayComponent()?.toggle({ source: this.el.querySelector('[data-isas-date-picker-trigger]') }) ?? false;
    }

    clear() {
        if (this.isDisabled() || this.isReadOnly()) return false;
        const draftCancelled = Boolean(this.state.draft);
        this.state.draft = '';
        const valueCleared = this.state.value ? this.commitValue('') : false;
        this.driver.setValue([]);
        if (draftCancelled && !valueCleared) this.requestRender();
        return draftCancelled || valueCleared;
    }

    selectionCompleted() {
        const close = this.attrs.has('close-on-select')
            ? this.attrs.boolean('close-on-select')
            : true;
        if (close) queueMicrotask(() => this.close());
    }

    focusValidationTarget() {
        this.el.querySelector('[data-isas-date-picker-trigger]')?.focus();
    }

    destroy() {
        this.overlayBinding?.cleanup();
        this.overlayBinding = null;
        super.destroy();
    }
}
