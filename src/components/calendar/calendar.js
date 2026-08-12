import { Component } from '../../component.js';
import { AttributeBag } from '../../support/attribute-bag.js';
import { escapeHtml, renderElement as element, visibleNodes } from '../../support/html.js';
import { CalendarDriver } from './calendar-driver.js';
import {
    formatCalendarValue,
    parseCalendarDate,
    parseCalendarValue,
    presetDates,
    serializeDates,
    todayDate,
} from './value.js';

let nextCalendarId = 0;
const SELECTIONS = new Set(['single', 'range']);
const LAYOUTS = new Set(['fit', 'fill']);
const MONTH_COLUMNS = 4;
const YEAR_COLUMNS = 4;
const FIT_MONTH_WIDTH = 18;
const FIT_WEEK_NUMBER_WIDTH = 2;
const MONTH_GAP = 1;

function integerAttribute(attrs, name, fallback, min, max) {
    const value = Number.parseInt(attrs.get(name), 10);
    return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function mergeDayScope(element, day) {
    const scope = `$day: Object.freeze(${JSON.stringify(day)})`;
    const current = element.getAttribute('x-data');
    element.setAttribute('x-data', current
        ? `Object.assign({}, (${current}), { ${scope} })`
        : `{ ${scope} }`);
}

export class Calendar extends Component {
    static structural = true;
    static stableSlots = ['day'];
    static preserveHostDuringMorph = true;

    mount() {
        // Fail authored template mistakes before starting Zag so an
        // initialization error cannot leave a subscribed machine behind.
        this.dayTemplates = this.templateRegistry();
        this.calendarId = this.el.id || `x-isas-calendar-${++nextCalendarId}`;
        this.syncingHost = false;
        this.initialized = false;
        this.formControl = null;
        this.formResetCleanup = null;
        this.formInvalidCleanup = null;
        this.defaultValue = '';
        this.externalValueInvalid = false;
        this.ownedValidityMessage = '';
        this.state = this.reactive({
            value: '',
            draft: '',
            validationVisible: false,
            validationMessage: '',
        });
        this.driver = new CalendarDriver(this, this.calendarId);
        this.listen(this.el, 'input', (event) => this.hostValueChanged(event));
        this.listen(this.el, 'change', (event) => this.hostValueChanged(event));
        queueMicrotask(() => queueMicrotask(() => this.initializeValue()));
    }

    selection() {
        const value = String(this.attrs?.get('selection') ?? 'single').toLowerCase();
        return SELECTIONS.has(value) ? value : 'single';
    }

    layout() {
        const value = String(this.attrs?.get('layout') ?? 'fit').toLowerCase();
        return LAYOUTS.has(value) ? value : 'fit';
    }

    monthWidth() {
        return FIT_MONTH_WIDTH + (this.attrs?.boolean('show-week-numbers')
            ? FIT_WEEK_NUMBER_WIDTH
            : 0);
    }

    calendarWidth() {
        const months = integerAttribute(this.attrs, 'months', 1, 1, 3);
        return (months * this.monthWidth()) + ((months - 1) * MONTH_GAP);
    }

    locale() {
        return String(this.attrs?.get('locale') ?? document.documentElement.lang ?? 'en-US') || 'en-US';
    }

    startOfWeek() {
        return integerAttribute(this.attrs, 'first-day-of-week', 1, 0, 6);
    }

    machineProps(id) {
        const parsed = this.selection() === 'range' && this.state?.draft
            ? { dates: [parseCalendarDate(this.state.draft)].filter(Boolean) }
            : parseCalendarValue(this.state?.value, this.selection());
        const min = parseCalendarDate(this.attrs?.get('min')) ?? undefined;
        const max = parseCalendarDate(this.attrs?.get('max')) ?? undefined;
        const focused = parsed.dates[0] ?? todayDate(this.attrs?.get('today'));
        return {
            id,
            inline: true,
            locale: this.locale(),
            timeZone: 'UTC',
            selectionMode: this.selection(),
            value: parsed.dates,
            defaultFocusedValue: focused,
            min,
            max,
            startOfWeek: this.startOfWeek(),
            numOfMonths: integerAttribute(this.attrs, 'months', 1, 1, 3),
            showWeekNumbers: this.attrs?.boolean('show-week-numbers'),
            disabled: this.isDisabled(),
            readOnly: this.isReadOnly(),
            required: this.attrs?.boolean('required'),
            closeOnSelect: false,
            onValueChange: (details) => this.driverValueChanged(details.value),
        };
    }

    initializeValue() {
        if (this.initialized || !this.el.isConnected) return;
        this.initialized = true;
        const initial = this.el._x_model
            ? this.el._x_model.get()
            : (this.attrs.has('value') ? this.attrs.get('value') : this.el.value);
        this.applyExternalValue(initial);
        this.defaultValue = this.state.value;
        this.startModelEffect();
    }

    startModelEffect() {
        const Alpine = globalThis.Alpine;
        if (!Alpine?.effect || !this.el._x_model) return;
        const runner = Alpine.effect(() => {
            const value = this.el._x_model?.get();
            if (this.syncingHost) return;
            // Keep driver/state reads outside Alpine's model effect. Otherwise
            // range draft state becomes an accidental dependency and the
            // unchanged committed model immediately clears the first click.
            queueMicrotask(() => {
                if (!this.syncingHost && this.el.isConnected) {
                    this.applyExternalValue(value);
                }
            });
        });
        this.onCleanup(() => Alpine.release?.(runner));
    }

    applyExternalValue(value) {
        const parsed = parseCalendarValue(value, this.selection());
        this.externalValueInvalid = !parsed.valid;
        this.state.value = parsed.value;
        this.state.draft = '';
        this.runtime.mutateHost((host) => { host.value = parsed.value; });
        this.driver.update();
        this.driver.setValue(parsed.dates);
        this.syncFormControl();
        this.requestRender();
    }

    hostValueChanged(event) {
        if (event.target !== this.el || this.syncingHost || !this.initialized) return;
        this.applyExternalValue(this.el.value);
    }

    driverValueChanged(dates) {
        if (!this.initialized) return;
        if (this.selection() === 'range' && dates.length === 1) {
            this.state.draft = String(dates[0]);
            this.requestRender();
            return;
        }
        const value = serializeDates(dates, this.selection());
        if (!value && dates.length) return;
        this.state.draft = '';
        this.commitValue(value);
        this.selectionCompleted?.();
    }

    commitValue(value) {
        if (value === this.state.value && !this.externalValueInvalid) return false;
        this.state.value = value;
        this.externalValueInvalid = false;
        this.syncingHost = true;
        this.runtime.mutateHost((host) => { host.value = value; });
        this.syncFormControl();
        try {
            this.el.dispatchEvent(new Event('input', { bubbles: true }));
            this.el.dispatchEvent(new Event('change', { bubbles: true }));
        } finally {
            this.syncingHost = false;
        }
        this.requestRender();
        return true;
    }

    cancelDraft() {
        if (!this.state.draft) return false;
        this.state.draft = '';
        const parsed = parseCalendarValue(this.state.value, this.selection());
        this.driver.setValue(parsed.dates);
        this.requestRender();
        return true;
    }

    applyPreset(value, preset = null) {
        const explicit = parseCalendarValue(value, this.selection());
        let dates = explicit.valid && explicit.dates.length ? explicit.dates : [];
        if (!dates.length && preset) {
            dates = presetDates(preset, todayDate(this.attrs.get('today')), this.startOfWeek());
        }
        if (this.selection() === 'single') dates = dates.slice(-1);
        if (this.selection() === 'range' && dates.length === 1) dates = [dates[0], dates[0]];
        const serialized = serializeDates(dates, this.selection());
        if (!serialized) return false;
        this.state.draft = '';
        this.driver.setValue(dates);
        this.commitValue(serialized);
        this.selectionCompleted?.();
        return true;
    }

    isDisabled() {
        return this.attrs?.boolean('disabled') || this.el.hasAttribute('disabled');
    }

    isReadOnly() {
        return this.attrs?.boolean('readonly') || this.el.hasAttribute('readonly');
    }

    mergeScope() {
        return {
            get value() { return this.state.value; },
            set value(value) { this.applyExternalValue(value); },
            get displayValue() { return formatCalendarValue(
                this.state.value,
                this.selection(),
                this.locale(),
                String(this.attrs.get('date-style') ?? 'medium'),
            ); },
            get draft() { return this.state.draft; },
            get selection() { return this.selection(); },
            get formControl() { return this.formControl; },
            get form() { return this.formControl?.form ?? null; },
            get validity() { return this.formControl?.validity ?? null; },
            get valid() { return this.formControl?.validity?.valid ?? true; },
            get invalid() { return this.state.validationVisible; },
            get validationMessage() { return this.state.validationMessage; },
            clear: () => this.commitValue(''),
            applyPreset: (value, preset) => this.applyPreset(value, preset),
            cancelDraft: () => this.cancelDraft(),
            checkValidity: () => this.checkValidity(),
            reportValidity: () => this.reportValidity(),
            setCustomValidity: (message) => this.setCustomValidity(message),
        };
    }

    templateRegistry() {
        let general = null;
        const exact = new Map();
        for (const node of this.slots.get('day').all()) {
            if (node.nodeType !== Node.ELEMENT_NODE || node.localName !== 'template') {
                throw new Error("Component 'calendar' day slots must use <template slot='day'>.");
            }
            const roots = visibleNodes(node.content.childNodes);
            if (roots.length !== 1 || roots[0].nodeType !== Node.ELEMENT_NODE) {
                throw new Error("Component 'calendar' day templates require exactly one root element.");
            }
            const dateValue = node.getAttribute('date');
            if (dateValue === null) {
                if (general) throw new Error("Component 'calendar' accepts only one general day template.");
                general = roots[0];
                continue;
            }
            if (!parseCalendarDate(dateValue)) {
                throw new Error(`Component 'calendar' day template date '${dateValue}' must use YYYY-MM-DD.`);
            }
            if (exact.has(dateValue)) {
                throw new Error(`Component 'calendar' has duplicate day template date '${dateValue}'.`);
            }
            exact.set(dateValue, roots[0]);
        }
        return { general, exact };
    }

    prepareRender() {
        this.dayTemplates = this.templateRegistry();
        return { displayValue: formatCalendarValue(
            this.state.value,
            this.selection(),
            this.locale(),
            String(this.attrs.get('date-style') ?? 'medium'),
        ) };
    }

    hostAttributes() {
        return {
            'data-isas-calendar': '',
            'data-selection': this.selection(),
            'data-layout': this.layout(),
            'data-disabled': this.isDisabled() || undefined,
            'data-readonly': this.isReadOnly() || undefined,
            'data-invalid': this.state.validationVisible || undefined,
            'data-drafting': Boolean(this.state.draft) || undefined,
        };
    }

    renderFormControl() {
        const type = this.selection() === 'single' ? 'date' : 'text';
        const attributes = this.attrs.for('native').merge({
            type,
            name: this.attrs.get('name') ?? undefined,
            form: this.attrs.get('form') ?? undefined,
            required: this.attrs.boolean('required'),
            disabled: this.isDisabled(),
            min: type === 'date' ? this.attrs.get('min') ?? undefined : undefined,
            max: type === 'date' ? this.attrs.get('max') ?? undefined : undefined,
            value: this.state.value,
            tabindex: '-1',
            'aria-hidden': 'true',
            'data-isas-calendar-control': '',
        }).remove('hidden');
        return element('input', attributes, null);
    }

    renderCalendarContent() {
        const api = this.driver.api;
        const header = element('header', this.attrs.for('header'), [
            element('button', this.attrs.for('previous').merge({ type: 'button', 'data-zag-action': 'prev' }), '‹'),
            element('button', this.attrs.for('view-trigger').merge({ type: 'button', 'data-zag-action': 'view' }), escapeHtml(api.visibleRangeText.formatted)),
            element('button', this.attrs.for('next').merge({ type: 'button', 'data-zag-action': 'next' }), '›'),
        ].join(''));
        const views = api.view === 'day' ? this.renderDayView(api)
            : (api.view === 'month' ? this.renderMonthView(api) : this.renderYearView(api));
        return element('div', this.attrs.for('content').merge({ 'data-isas-calendar-content': '' }), `${header}${views}`);
    }

    renderDayView(api) {
        const months = [];
        for (let monthIndex = 0; monthIndex < api.numOfMonths; monthIndex += 1) {
            const offset = api.getOffset({ months: monthIndex });
            const tableId = `month-${monthIndex}`;
            const headings = api.weekDays.map((day) => element(
                'th',
                this.attrs.for('weekday').merge({ scope: 'col', title: day.long }),
                escapeHtml(day.narrow),
            ));
            if (api.showWeekNumbers) headings.unshift(element(
                'th', this.attrs.for('week-number').merge({ scope: 'col' }), '#',
            ));
            const rows = offset.weeks.map((week) => {
                const cells = week.map((date) => this.renderDay(api, date, offset.visibleRange, monthIndex));
                if (api.showWeekNumbers) cells.unshift(element(
                    'th',
                    this.attrs.for('week-number').merge({ scope: 'row' }),
                    String(api.getWeekNumber(week)),
                ));
                return element('tr', new AttributeBag(), cells.join(''));
            });
            const monthStyle = this.layout() === 'fill'
                ? `flex: 1 1 ${this.monthWidth()}rem; min-width: min(${this.monthWidth()}rem, 100%)`
                : `flex: 0 0 ${this.monthWidth()}rem; width: ${this.monthWidth()}rem; max-width: 100%`;
            months.push(element('section', this.attrs.for('month').merge({ style: monthStyle }), [
                element('h3', this.attrs.for('month-label'), escapeHtml(offset.visibleRangeText.start)),
                `<table ${this.attrs.for('table').merge({ 'data-zag-table': 'day', 'data-table-id': tableId }).toString()}>`,
                `<thead><tr>${headings.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`,
            ].join('')));
        }
        return element('div', this.attrs.for('months').merge({
            'data-zag-view': 'day',
            style: this.layout() === 'fill' ? 'width: 100%' : undefined,
        }), months.join(''));
    }

    dayFacade(api, date, visibleRange) {
        const state = api.getDayTableCellState({ value: date, visibleRange });
        const value = String(date);
        const configuredToday = String(todayDate(this.attrs.get('today')));
        return Object.freeze({
            value,
            number: date.day,
            label: state.valueText,
            today: value === configuredToday,
            outside: state.outsideRange,
            disabled: !state.selectable,
            selected: state.selected,
            rangeStart: state.firstInRange,
            rangeEnd: state.lastInRange,
            inRange: state.inRange,
        });
    }

    syncDayScope(element, api, date, visibleRange) {
        if (!element?.hasAttribute('x-data')) return;
        const scope = element._x_dataStack?.find((candidate) => (
            Object.hasOwn(candidate, '$day')
        ));
        if (!scope) return;
        scope.$day = Object.freeze({
            ...this.dayFacade(api, date, visibleRange),
            selected: element.hasAttribute('data-selected'),
            rangeStart: element.hasAttribute('data-range-start'),
            rangeEnd: element.hasAttribute('data-range-end'),
            inRange: element.hasAttribute('data-in-range'),
        });
    }

    renderDay(api, date, visibleRange, monthIndex) {
        const day = this.dayFacade(api, date, visibleRange);
        const template = this.dayTemplates.exact.get(day.value) ?? this.dayTemplates.general;
        let trigger;
        if (template) {
            trigger = template.cloneNode(true);
            mergeDayScope(trigger, day);
            const authored = AttributeBag.fromElement(trigger);
            const merged = authored.merge(this.attrs.for('day')).merge({
                type: trigger.localName === 'button' ? 'button' : undefined,
                role: trigger.localName === 'button' ? undefined : 'button',
                'data-zag-day-trigger': '',
                'data-isas-key': `calendar-day:${day.value}`,
            });
            for (const [name, value] of merged.entries()) {
                if (value !== false && value !== null && value !== undefined) {
                    trigger.setAttribute(name, value === true ? '' : String(value));
                }
            }
        } else {
            trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.textContent = String(day.number);
            for (const [name, value] of this.attrs.for('day').merge({
                'data-zag-day-trigger': '',
                'data-isas-key': `calendar-day:${day.value}`,
            }).entries()) trigger.setAttribute(name, value === true ? '' : String(value));
        }
        return element('td', new AttributeBag({
            'data-zag-day-cell': '',
            'data-date': day.value,
            'data-month-index': monthIndex,
        }), trigger.outerHTML);
    }

    renderMonthView(api) {
        const rows = api.getMonthsGrid({ columns: MONTH_COLUMNS, format: 'short' }).map((row) => element(
            'tr', new AttributeBag(), row.map((cell) => element('td', new AttributeBag({
                'data-zag-month-cell': '',
                'data-value': cell.value,
                'data-columns': MONTH_COLUMNS,
                'data-disabled': String(Boolean(cell.disabled)),
            }), element('button', this.attrs.for('month-option').merge({ type: 'button' }), escapeHtml(cell.label)))).join(''),
        ));
        return element(
            'div',
            this.attrs.for('months').merge({
                'data-zag-view': 'month',
                style: this.layout() === 'fill'
                    ? 'width: 100%'
                    : `width: ${this.calendarWidth()}rem; max-width: 100%`,
            }),
            element(
                'table',
                this.attrs.for('table').merge({
                    'data-zag-table': 'month',
                    'data-columns': MONTH_COLUMNS,
                }),
                `<tbody>${rows.join('')}</tbody>`,
            ),
        );
    }

    renderYearView(api) {
        const rows = api.getYearsGrid({ columns: YEAR_COLUMNS }).map((row) => element(
            'tr', new AttributeBag(), row.map((cell) => element('td', new AttributeBag({
                'data-zag-year-cell': '',
                'data-value': cell.value,
                'data-columns': YEAR_COLUMNS,
                'data-disabled': String(Boolean(cell.disabled)),
            }), element('button', this.attrs.for('year-option').merge({ type: 'button' }), escapeHtml(cell.label)))).join(''),
        ));
        return element(
            'div',
            this.attrs.for('months').merge({
                'data-zag-view': 'year',
                style: this.layout() === 'fill'
                    ? 'width: 100%'
                    : `width: ${this.calendarWidth()}rem; max-width: 100%`,
            }),
            element(
                'table',
                this.attrs.for('table').merge({
                    'data-zag-table': 'year',
                    'data-columns': YEAR_COLUMNS,
                }),
                `<tbody>${rows.join('')}</tbody>`,
            ),
        );
    }

    queueDriverBind() {
        queueMicrotask(() => queueMicrotask(() => {
            if (this.el.isConnected) this.driver.bindRendered();
        }));
    }

    render() {
        const html = `${this.renderFormControl()}${this.renderCalendarContent()}${this.renderError()}`;
        this.queueDriverBind();
        return html;
    }

    renderError() {
        return element('p', this.attrs.for('error').merge({
            hidden: !this.state.validationVisible,
            'aria-live': 'polite',
            'data-isas-calendar-error': '',
        }), escapeHtml(this.state.validationMessage));
    }

    bindFormControl() {
        const control = this.el.querySelector('[data-isas-calendar-control]');
        if (control === this.formControl) {
            this.syncFormControl();
            return;
        }
        this.formInvalidCleanup?.();
        this.formControl = control;
        if (!control) return;
        const invalid = (event) => {
            event.preventDefault();
            this.refreshValidation({ show: true, focus: true });
        };
        control.addEventListener('invalid', invalid);
        this.formInvalidCleanup = () => control.removeEventListener('invalid', invalid);
        this.bindFormReset();
        this.syncFormControl();
    }

    syncFormControl() {
        const control = this.formControl;
        if (!control) return;
        if (control.value !== this.state.value) control.value = this.state.value;
        let message = String(this.attrs.get('error') ?? '').trim();
        if (this.externalValueInvalid) message = 'Enter a valid calendar value.';
        if (!message && this.selection() === 'range' && this.state.value) {
            const parsed = parseCalendarValue(this.state.value, 'range');
            const min = parseCalendarDate(this.attrs.get('min'));
            const max = parseCalendarDate(this.attrs.get('max'));
            if (min && parsed.dates[0]?.compare(min) < 0) message = `Date must be ${min} or later.`;
            if (max && parsed.dates[1]?.compare(max) > 0) message = `Date must be ${max} or earlier.`;
        }
        if (this.ownedValidityMessage && control.validationMessage === this.ownedValidityMessage) {
            control.setCustomValidity('');
        }
        if (message) control.setCustomValidity(message);
        this.ownedValidityMessage = message;
        this.refreshValidation({ show: Boolean(this.attrs.get('error')) });
    }

    bindFormReset() {
        const form = this.formControl?.form ?? null;
        if (this.formResetCleanup?.form === form) return;
        this.formResetCleanup?.();
        this.formResetCleanup = null;
        if (!form) return;
        const reset = () => queueMicrotask(() => {
            this.applyExternalValue(this.defaultValue);
            this.el._x_model?.set(this.defaultValue);
            this.refreshValidation({ reset: true });
        });
        form.addEventListener('reset', reset);
        const cleanup = () => form.removeEventListener('reset', reset);
        cleanup.form = form;
        this.formResetCleanup = cleanup;
    }

    refreshValidation({ show = false, reset = false, focus = false } = {}) {
        const control = this.formControl;
        const valid = control?.validity?.valid ?? true;
        const previousVisible = this.state.validationVisible;
        const previousMessage = this.state.validationMessage;
        if (reset || valid) this.state.validationVisible = false;
        if (show && !valid) this.state.validationVisible = true;
        this.state.validationMessage = this.state.validationVisible
            ? (control?.validationMessage ?? '')
            : '';
        if (previousVisible !== this.state.validationVisible
            || previousMessage !== this.state.validationMessage) {
            this.requestRender();
        }
        if (focus && !valid) this.focusValidationTarget();
        return valid;
    }

    focusValidationTarget() {
        this.el.querySelector('[data-zag-day-trigger]:not([aria-disabled="true"])')?.focus();
    }

    checkValidity() {
        return this.formControl?.checkValidity() ?? true;
    }

    reportValidity() {
        const valid = this.formControl?.reportValidity() ?? true;
        if (!valid) this.refreshValidation({ show: true, focus: true });
        return valid;
    }

    setCustomValidity(message = '') {
        if (!this.formControl) return false;
        this.formControl.setCustomValidity(String(message ?? ''));
        this.ownedValidityMessage = String(message ?? '');
        this.refreshValidation({ show: Boolean(message) });
        return true;
    }

    attributeChanged(name) {
        if (!this.initialized) return;
        if (name === 'value' && !this.el._x_model) this.applyExternalValue(this.attrs.get('value'));
        if (name === 'selection') this.applyExternalValue(this.state.value);
        if (['locale', 'today', 'min', 'max', 'first-day-of-week', 'months', 'show-week-numbers', 'disabled', 'readonly', 'required', 'error'].includes(name)) {
            this.driver.update();
            this.syncFormControl();
        }
    }

    sourceChanged() {
        if (!this.initialized) return;
        if (!this.el._x_model && this.attrs.has('value')) this.applyExternalValue(this.attrs.get('value'));
        this.driver.update();
        this.syncFormControl();
    }

    destroy() {
        this.formInvalidCleanup?.();
        this.formResetCleanup?.();
        this.driver?.destroy();
        this.formControl = null;
    }
}
