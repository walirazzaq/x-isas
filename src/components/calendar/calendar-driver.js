import * as datePicker from '@zag-js/date-picker';
import { normalizeProps, spreadProps, VanillaMachine } from '@zag-js/vanilla';
import { parseCalendarDate } from './value.js';

/** Private boundary around Zag. No Zag objects escape into the public component scope. */
export class CalendarDriver {
    constructor(component, id) {
        this.component = component;
        this.id = id;
        this.bindings = new Map();
        this.service = new VanillaMachine(datePicker.machine, () => component.machineProps(id));
        this.unsubscribe = this.service.subscribe(() => component.requestRender());
        this.service.start();
    }

    get api() {
        return datePicker.connect(this.service.service, normalizeProps);
    }

    update() {
        this.service.updateProps(() => this.component.machineProps(this.id));
    }

    setValue(dates) {
        this.api.setValue(dates);
    }

    bind(element, props) {
        if (!element || !props) return;
        const previous = this.previousBindings?.get(element);
        if (previous) {
            previous.cleanup();
            for (const name of Object.keys(previous.props)) {
                if (name.startsWith('on') || props[name] != null) continue;
                if (name === 'value' || name === 'checked' || name === 'selected') {
                    element[name] = '';
                } else if (name !== 'children') {
                    element.removeAttribute(name.toLowerCase());
                }
            }
        }
        this.bindings.set(element, {
            cleanup: spreadProps(element, props, this.id),
            props,
        });
    }

    bindRendered() {
        const previousBindings = this.bindings;
        this.bindings = new Map();
        this.previousBindings = previousBindings;
        const host = this.component.el;
        if (!host.isConnected) {
            for (const binding of previousBindings.values()) binding.cleanup();
            this.previousBindings = null;
            return;
        }
        const api = this.api;
        // The component host is observed by HostRuntime. Drain Zag's managed
        // root attributes so they are not mistaken for authored attributes and
        // fed back into another structural render.
        this.component.runtime.mutateHost(() => this.bind(host, api.getRootProps()));
        this.bind(host.querySelector('[data-isas-calendar-content]'), api.getContentProps());

        for (const node of host.querySelectorAll('[data-zag-action]')) {
            const action = node.dataset.zagAction;
            if (action === 'prev') this.bind(node, api.getPrevTriggerProps({ view: api.view }));
            if (action === 'next') this.bind(node, api.getNextTriggerProps({ view: api.view }));
            if (action === 'view') this.bind(node, api.getViewTriggerProps({ view: api.view }));
            if (action === 'clear') this.bind(node, api.getClearTriggerProps());
        }

        for (const view of host.querySelectorAll('[data-zag-view]')) {
            this.bind(view, api.getViewProps({ view: view.dataset.zagView }));
        }
        for (const table of host.querySelectorAll('[data-zag-table]')) {
            const view = table.dataset.zagTable;
            const id = table.dataset.tableId;
            const props = { view, id, columns: Number(table.dataset.columns) || undefined };
            this.bind(table, api.getTableProps(props));
            this.bind(table.querySelector('thead'), api.getTableHeadProps(props));
            this.bind(table.querySelector('tbody'), api.getTableBodyProps(props));
            for (const row of table.querySelectorAll('tr')) this.bind(row, api.getTableRowProps(props));
        }

        for (const cell of host.querySelectorAll('[data-zag-day-cell]')) {
            const value = parseCalendarDate(cell.dataset.date);
            if (!value) continue;
            const offset = api.getOffset({ months: Number(cell.dataset.monthIndex) || 0 });
            const props = { value, visibleRange: offset.visibleRange };
            this.bind(cell, api.getDayTableCellProps(props));
            const trigger = cell.querySelector('[data-zag-day-trigger]');
            this.bind(trigger, api.getDayTableCellTriggerProps(props));
            this.component.syncDayScope?.(trigger, api, value, offset.visibleRange);
        }
        for (const cell of host.querySelectorAll('[data-zag-month-cell], [data-zag-year-cell]')) {
            const value = Number(cell.dataset.value);
            const columns = Number(cell.dataset.columns) || undefined;
            const props = { value, columns, disabled: cell.dataset.disabled === 'true' };
            const month = cell.hasAttribute('data-zag-month-cell');
            this.bind(cell, month
                ? api.getMonthTableCellProps(props)
                : api.getYearTableCellProps(props));
            this.bind(cell.firstElementChild, month
                ? api.getMonthTableCellTriggerProps(props)
                : api.getYearTableCellTriggerProps(props));
        }

        this.component.bindFormControl();
        this.component.afterDriverBind?.();

        // spreadProps cleanup removes listeners but forgets its previous prop
        // set. Our binding records carry that set across morphs so bind() can
        // remove obsolete state attributes before applying the complete current
        // props. Roots absent from the new render are fully cleaned up here.
        for (const [element, binding] of previousBindings) {
            if (!this.bindings.has(element)) binding.cleanup();
        }
        this.previousBindings = null;
    }

    clearBindings() {
        for (const binding of [...this.bindings.values()].reverse()) binding.cleanup();
        this.bindings.clear();
    }

    destroy() {
        this.clearBindings();
        this.unsubscribe?.();
        this.service.stop();
    }
}
