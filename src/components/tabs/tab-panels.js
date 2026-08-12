import { Component } from '../../component.js';
import { AttributeBag } from '../../support/attribute-bag.js';
import { serializeNode } from '../../support/html.js';
import { tabsRegistry } from './tabs-registry.js';

let nextPanelHostId = 0;

function normalizedName(value) {
    return String(value ?? '').trim();
}

function idToken(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'panel';
}

function contribute(part, attributes) {
    const managed = AttributeBag.from(attributes);
    part.attrs = managed.merge(part.attrs);
    part.managedAttributes = managed.merge(part.managedAttributes);
}

export class TabPanels extends Component {
    static attachable = true;
    static activationAttribute = 'controlled-by-tabs';
    static defaultNamespace = '$tabPanels';
    static structural = true;

    static parts = {
        'tab-content': {},
    };

    mount() {
        this.hostKey = ++nextPanelHostId;
        this.controller = null;
        this.unsubscribe = null;
        this.linkedId = '';
        this.primaryRecords = [];
        this.contents = new Set();
        this.recordsSignature = '';
        this.warnedUnresolvedId = '';
        this.warnedUnknownNames = new Set();
        this.state = this.reactive({
            value: '',
            previousValue: '',
            selectedIndex: -1,
            previousIndex: -1,
            direction: 'none',
            managed: false,
            linked: false,
            tabs: null,
        });
        queueMicrotask(() => {
            if (this.el.isConnected) this.relink();
        });
    }

    targetId() {
        return normalizedName(this.el.getAttribute('controlled-by-tabs'));
    }

    relink() {
        const id = this.targetId();
        if (!id) {
            this.unlink();
            throw new Error("Component 'tab-panels' requires controlled-by-tabs.");
        }
        if (id === this.linkedId && this.unsubscribe) return;
        this.unlink();
        this.linkedId = id;
        this.unsubscribe = tabsRegistry.subscribe(
            this.el.ownerDocument,
            id,
            (controller) => this.setController(controller),
        );
    }

    setController(controller) {
        if (controller === this.controller) return;
        this.controller?.removePanelHost(this);
        this.controller = controller;
        this.warnedUnresolvedId = '';
        this.controller?.addPanelHost(this);
        this.syncProxyState();
        this.refreshFromController();
    }

    unlink() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.linkedId = '';
        this.setController(null);
    }

    visibilityMode() {
        return String(this.attrs?.get('visibility') ?? 'automatic').toLowerCase() === 'manual'
            ? 'manual'
            : 'automatic';
    }

    generatedPanelId(name) {
        return `${this.targetId() || 'tabs'}-panel-${this.hostKey}-${idToken(name)}`;
    }

    prepareRender() {
        if (this.mode !== 'primary') return { linked: Boolean(this.controller) };
        const panels = this.parts.parts.filter((part) => part.name === 'tab-content');
        const records = panels.map((part) => {
            const name = normalizedName(part.attrs.get('name'));
            if (!name) {
                throw new Error(
                    "Component 'tab-panels' requires every x-part='tab-content' to have a name.",
                );
            }
            return {
                name,
                id: normalizedName(part.attrs.get('id')) || this.generatedPanelId(name),
                part,
                component: null,
            };
        });
        this.assertUnique(records);
        this.primaryRecords = records;
        this.recordsChanged();
        if (this.controller) {
            for (const record of records) this.applyPanelPart(record);
        }
        return { linked: Boolean(this.controller) };
    }

    applyPanelPart(record) {
        const tab = this.controller.tab(record.name);
        const active = this.controller.isSelected(record.name);
        const attributes = {
            id: record.id,
            role: 'tabpanel',
            'aria-labelledby': tab?.id || false,
            'aria-hidden': active ? 'false' : 'true',
            'data-isas-tab-state': this.controller.memberState(record.name),
            'data-isas-tab-position': this.controller.position(record.name),
        };
        if (this.visibilityMode() === 'automatic') attributes.hidden = !active;
        contribute(record.part, attributes);
    }

    assertUnique(records = this.panelRecords()) {
        const seen = new Set();
        for (const record of records) {
            if (seen.has(record.name)) {
                throw new Error(
                    `Component 'tab-panels' requires unique panel name '${record.name}' within one host.`,
                );
            }
            seen.add(record.name);
        }
    }

    registerContent(content) {
        this.contents.add(content);
        this.assertUnique(this.panelRecords());
        this.recordsChanged();
        content.syncFromOwner();
    }

    unregisterContent(content) {
        if (!this.contents.delete(content)) return;
        this.recordsChanged();
    }

    contentChanged() {
        this.assertUnique(this.panelRecords());
        this.recordsChanged();
    }

    panelRecords() {
        return [
            ...this.primaryRecords,
            ...[...this.contents].map((content) => content.panelRecord()),
        ];
    }

    recordsChanged() {
        const signature = this.panelRecords()
            .map((record) => `${record.name}:${record.id}`)
            .join('|');
        if (signature === this.recordsSignature) return;
        this.recordsSignature = signature;
        queueMicrotask(() => {
            if (!this.el.isConnected) return;
            this.controller?.component.requestRender();
            for (const content of this.contents) content.syncFromOwner();
        });
    }

    refreshFromController() {
        this.syncProxyState();
        if (this.mode === 'primary') this.requestRender();
        for (const content of this.contents) content.syncFromOwner();
        queueMicrotask(() => this.warnUnknownPanels());
    }

    syncProxyState() {
        const controller = this.controller;
        this.state.value = controller?.state.value ?? '';
        this.state.previousValue = controller?.state.previousValue ?? '';
        this.state.selectedIndex = controller?.state.selectedIndex ?? -1;
        this.state.previousIndex = controller?.state.previousIndex ?? -1;
        this.state.direction = controller?.state.direction ?? 'none';
        this.state.managed = controller?.managed ?? false;
        this.state.linked = Boolean(controller);
        this.state.tabs = controller?.el ?? null;
    }

    warnUnknownPanels() {
        if (!this.controller?.initialized) return;
        for (const { name } of this.panelRecords()) {
            if (this.controller.tab(name) || this.warnedUnknownNames.has(name)) continue;
            this.warnedUnknownNames.add(name);
            console.warn(
                `Component 'tab-panels' has no tab named '${name}' in '${this.targetId()}'.`,
            );
        }
    }

    warnUnresolved() {
        const id = this.targetId();
        if (!id || this.warnedUnresolvedId === id) return;
        this.warnedUnresolvedId = id;
        console.warn(`No 'tabs' component with id '${id}' is currently available.`);
    }

    call(method, ...args) {
        if (!this.controller) {
            this.warnUnresolved();
            return false;
        }
        return this.controller[method](...args);
    }

    mergeScope() {
        return {
            get value() { return this.state.value; },
            set value(value) { this.call('select', value); },
            get previousValue() { return this.state.previousValue; },
            get selectedIndex() { return this.state.selectedIndex; },
            get previousIndex() { return this.state.previousIndex; },
            get direction() { return this.state.direction; },
            get managed() { return this.state.managed; },
            get linked() { return this.state.linked; },
            get tabs() { return this.state.tabs; },
            select: (name) => this.call('select', name),
            isSelected: (name) => this.controller?.isSelected(name) ?? false,
            position: (name) => this.controller?.position(name) ?? 'after',
            next: () => this.call('next'),
            previous: () => this.call('previous'),
            first: () => this.call('first'),
            last: () => this.call('last'),
        };
    }

    hostAttributes() {
        if (this.mode !== 'primary' || !this.controller) return {};
        return {
            'data-isas-tabs-linked': '',
            'data-isas-tabs-direction': this.controller.state.direction,
        };
    }

    render() {
        if (this.mode !== 'primary') return undefined;
        const parts = new Map(this.parts.ordered().map((part) => [part.position, part]));
        return this.source.childNodes().map((node, position) => (
            parts.has(position) ? parts.get(position).html(this) : serializeNode(node)
        )).join('');
    }

    attributeChanged(name) {
        if (name === 'controlled-by-tabs') {
            queueMicrotask(() => {
                if (this.el.isConnected) this.relink();
            });
        }
        if (name === 'visibility') this.refreshFromController();
    }

    sourceChanged() {
        this.warnedUnknownNames.clear();
        queueMicrotask(() => {
            if (this.el.isConnected) this.relink();
        });
    }

    destroy() {
        this.unlink();
        for (const content of this.contents) content.detachOwner(this);
        this.contents.clear();
        this.primaryRecords = [];
    }
}
