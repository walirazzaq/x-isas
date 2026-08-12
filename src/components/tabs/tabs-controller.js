import { tabsRegistry } from './tabs-registry.js';

function directionBetween(previousIndex, index) {
    if (previousIndex < 0 || index < 0 || previousIndex === index) return 'none';
    return index > previousIndex ? 'next' : 'previous';
}

export class TabsController {
    constructor(component) {
        this.component = component;
        this.el = component.el;
        this.id = '';
        this.registered = false;
        this.initialized = false;
        this.initializing = false;
        this.tabs = [];
        this.localPanelCount = 0;
        this.panelHosts = new Set();
        this.syncingModel = false;
        this.state = component.reactive({
            value: '',
            previousValue: '',
            selectedIndex: -1,
            previousIndex: -1,
            direction: 'none',
        });
    }

    mount() {
        this.reconcileRegistration();
    }

    reconcileRegistration() {
        const id = String(this.el.id ?? '').trim();
        if (this.registered && id === this.id) return;
        if (this.registered) tabsRegistry.unregister(this);
        this.id = id;
        this.registered = false;
        if (!id) return;
        tabsRegistry.register(this);
        this.registered = true;
    }

    setTabs(tabs, localPanelCount) {
        this.tabs = tabs;
        this.localPanelCount = localPanelCount;
        if (this.initialized) this.reconcileSelection();
    }

    addPanelHost(host) {
        if (this.panelHosts.has(host)) return;
        this.panelHosts.add(host);
        this.refresh();
        this.ensureInitialized();
    }

    removePanelHost(host) {
        if (!this.panelHosts.delete(host)) return;
        this.refresh();
    }

    get managed() {
        return this.localPanelCount > 0 || this.panelHosts.size > 0;
    }

    get linked() {
        return this.panelHosts.size > 0;
    }

    ensureInitialized() {
        if (this.initialized || this.initializing || !this.managed) return;
        this.initializing = true;
        queueMicrotask(() => queueMicrotask(() => {
            this.initializing = false;
            if (!this.el.isConnected || this.initialized || !this.managed) return;
            this.initialize();
        }));
    }

    initialize() {
        this.component.validateManagedTabs(this.tabs);
        const requested = this.component.initialValue(this.tabs);
        const fallback = this.enabledTabs()[0]?.name ?? '';
        const value = this.enabledTab(requested)?.name ?? fallback;
        this.initialized = true;
        this.state.value = value;
        this.state.selectedIndex = this.indexOf(value);
        this.component.startModelEffect();
        this.component.syncHostValue();
        this.refresh();
    }

    enabledTabs() {
        return this.tabs.filter((tab) => !tab.disabled);
    }

    tab(name) {
        const normalized = String(name ?? '');
        return this.tabs.find((tab) => tab.name === normalized) ?? null;
    }

    enabledTab(name) {
        const tab = this.tab(name);
        return tab && !tab.disabled ? tab : null;
    }

    indexOf(name) {
        return this.tabs.findIndex((tab) => tab.name === String(name ?? ''));
    }

    reconcileSelection() {
        if (!this.managed) {
            return;
        }
        this.component.validateManagedTabs(this.tabs);
        const current = this.enabledTab(this.state.value);
        if (current) {
            this.state.selectedIndex = this.indexOf(current.name);
            return;
        }

        const start = Math.max(0, this.state.selectedIndex);
        const next = this.tabs.slice(start).find((tab) => !tab.disabled)
            ?? this.tabs.slice(0, start).reverse().find((tab) => !tab.disabled)
            ?? null;
        this.select(next?.name ?? '', {
            direction: next ? directionBetween(this.state.selectedIndex, this.indexOf(next.name)) : 'none',
            source: null,
        });
    }

    select(name, {
        direction = null,
        source = null,
        dispatch = true,
        force = false,
    } = {}) {
        if (!this.managed || !this.initialized) return false;
        const normalized = String(name ?? '');
        const tab = normalized === '' ? null : this.enabledTab(normalized);
        if (normalized && !tab) return false;
        if (!force && normalized === this.state.value) return false;

        const previousValue = this.state.value;
        const previousIndex = this.indexOf(previousValue);
        const index = tab ? this.indexOf(tab.name) : -1;
        this.state.previousValue = previousValue;
        this.state.previousIndex = previousIndex;
        this.state.value = tab?.name ?? '';
        this.state.selectedIndex = index;
        this.state.direction = direction ?? directionBetween(previousIndex, index);

        this.component.commitSelection({ dispatch });
        this.dispatchChange(source);
        this.refresh();
        return true;
    }

    isSelected(name) {
        return this.state.value === String(name ?? '');
    }

    isPrevious(name) {
        return Boolean(this.state.previousValue)
            && this.state.previousValue === String(name ?? '');
    }

    position(name) {
        const index = this.indexOf(name);
        if (index < 0 || this.state.selectedIndex < 0) return 'after';
        if (index === this.state.selectedIndex) return 'active';
        return index < this.state.selectedIndex ? 'before' : 'after';
    }

    memberState(name) {
        if (this.isSelected(name)) return 'active';
        if (this.isPrevious(name)) return 'previous';
        return 'inactive';
    }

    move(step, source = null) {
        const enabled = this.enabledTabs();
        if (!enabled.length) return false;
        const current = enabled.findIndex((tab) => tab.name === this.state.value);
        const origin = current < 0 ? 0 : current;
        const index = (origin + step + enabled.length) % enabled.length;
        return this.select(enabled[index].name, {
            direction: step > 0 ? 'next' : 'previous',
            source,
        });
    }

    next(source = null) {
        return this.move(1, source);
    }

    previous(source = null) {
        return this.move(-1, source);
    }

    first(source = null) {
        const tab = this.enabledTabs()[0];
        return tab ? this.select(tab.name, { source }) : false;
    }

    last(source = null) {
        const tab = this.enabledTabs().at(-1);
        return tab ? this.select(tab.name, { source }) : false;
    }

    panelRecords(name = null) {
        const records = [...this.panelHosts].flatMap((host) => host.panelRecords());
        return name === null
            ? records
            : records.filter((record) => record.name === String(name));
    }

    panelIds(name) {
        return this.panelRecords(name).map((record) => record.id);
    }

    dispatchChange(source) {
        const detail = {
            value: this.state.value,
            previousValue: this.state.previousValue,
            index: this.state.selectedIndex,
            previousIndex: this.state.previousIndex,
            direction: this.state.direction,
            source,
        };
        for (const element of [this.el, ...[...this.panelHosts].map((host) => host.el)]) {
            element.dispatchEvent(new CustomEvent('tabchange', {
                bubbles: true,
                composed: true,
                detail,
            }));
        }
    }

    refresh() {
        this.component.requestRender();
        for (const host of this.panelHosts) host.refreshFromController();
    }

    destroy() {
        if (this.registered) tabsRegistry.unregister(this);
        this.registered = false;
        for (const host of [...this.panelHosts]) host.setController(null);
        this.panelHosts.clear();
    }
}
