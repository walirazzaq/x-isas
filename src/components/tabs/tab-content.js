import { Component } from '../../component.js';

const MANAGED_ATTRIBUTES = [
    'id',
    'role',
    'aria-labelledby',
    'aria-hidden',
    'hidden',
    'data-isas-tab-state',
    'data-isas-tab-position',
];

function snapshot(element) {
    return new Map(MANAGED_ATTRIBUTES.map((name) => [
        name,
        element.hasAttribute(name) ? element.getAttribute(name) : null,
    ]));
}

function snapshotSource(source) {
    return new Map(MANAGED_ATTRIBUTES.map((name) => [
        name,
        source.attributes.has(name) ? source.attributes.get(name) : null,
    ]));
}

function restore(element, attributes) {
    for (const [name, value] of attributes) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
    }
}

export class TabContent extends Component {
    static attachable = true;
    static defaultNamespace = '$tabContent';

    mount() {
        if (this.mode !== 'attachment') {
            throw new Error("Component 'tab-content' is attachment-only; use x-as='tab-content'.");
        }
        this.ownerComponent = null;
        this.authoredAttributes = snapshot(this.el);
        this.state = this.reactive({
            name: this.nameValue(),
            active: false,
            previous: false,
            position: 'after',
            linked: false,
            tabs: null,
        });
        queueMicrotask(() => {
            if (this.el.isConnected) this.connectOwner();
        });
    }

    nameValue() {
        return String(this.el.getAttribute('name') ?? '').trim();
    }

    connectOwner() {
        const owner = this.owner('tab-panels');
        if (owner === this.ownerComponent) return Boolean(owner);
        this.ownerComponent?.unregisterContent(this);
        this.ownerComponent = owner;
        if (!owner) {
            restore(this.el, this.authoredAttributes);
            throw new Error("Component 'tab-content' requires an ancestor component 'tab-panels'.");
        }
        if (!this.nameValue()) {
            throw new Error("Component 'tab-content' requires a non-empty name.");
        }
        owner.registerContent(this);
        return true;
    }

    detachOwner(owner) {
        if (this.ownerComponent !== owner) return;
        this.ownerComponent = null;
        restore(this.el, this.authoredAttributes);
    }

    panelRecord() {
        const name = this.nameValue();
        return {
            name,
            id: this.el.id || this.ownerComponent?.generatedPanelId(name) || '',
            part: null,
            component: this,
        };
    }

    syncFromOwner() {
        const owner = this.ownerComponent;
        const controller = owner?.controller;
        if (!owner || !controller) {
            this.state.name = this.nameValue();
            this.state.active = false;
            this.state.previous = false;
            this.state.position = 'after';
            this.state.linked = false;
            this.state.tabs = null;
            this.runtime.mutateHost((element) => restore(element, this.authoredAttributes));
            return;
        }
        const record = this.panelRecord();
        const tab = controller.tab(record.name);
        const active = controller.isSelected(record.name);
        this.state.name = record.name;
        this.state.active = active;
        this.state.previous = controller.isPrevious(record.name);
        this.state.position = controller.position(record.name);
        this.state.linked = true;
        this.state.tabs = controller.el;
        this.runtime.mutateHost((element) => {
            element.id = record.id;
            element.setAttribute('role', 'tabpanel');
            if (tab?.id) element.setAttribute('aria-labelledby', tab.id);
            else element.removeAttribute('aria-labelledby');
            element.setAttribute('aria-hidden', active ? 'false' : 'true');
            element.setAttribute('data-isas-tab-state', controller.memberState(record.name));
            element.setAttribute('data-isas-tab-position', controller.position(record.name));
            if (owner.visibilityMode() === 'automatic') element.hidden = !active;
            else if (this.authoredAttributes.get('hidden') === null) element.removeAttribute('hidden');
            else element.setAttribute('hidden', this.authoredAttributes.get('hidden'));
        });
    }

    mergeScope() {
        return {
            get name() { return this.state.name; },
            get active() { return this.state.active; },
            get previous() { return this.state.previous; },
            get position() { return this.state.position; },
            get linked() { return this.state.linked; },
            get tabs() { return this.state.tabs; },
        };
    }

    attributeChanged(name) {
        if (name !== 'name') return;
        if (!this.nameValue()) throw new Error("Component 'tab-content' requires a non-empty name.");
        this.state.name = this.nameValue();
        this.ownerComponent?.contentChanged();
        this.syncFromOwner();
    }

    sourceChanged() {
        this.authoredAttributes = snapshotSource(this.source);
        this.connectOwner();
        this.ownerComponent?.contentChanged();
        this.syncFromOwner();
    }

    destroy() {
        this.ownerComponent?.unregisterContent(this);
        this.ownerComponent = null;
        restore(this.el, this.authoredAttributes);
    }
}
