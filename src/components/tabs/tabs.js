import { Component } from '../../component.js';
import { AttributeBag } from '../../support/attribute-bag.js';
import { renderElement, serializeNode } from '../../support/html.js';
import {
    prepareItemAppend,
    prepareItemPrepend,
} from '../../support/item-accessories.js';
import { TabsController } from './tabs-controller.js';

let nextTabsId = 0;

const TAB_ACCESSORY_ATTRIBUTES = new Set([
    'icon',
    'badge',
    'icon-end',
    'badge-end',
]);
const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

export function tabHasAccessories(attrs, slots) {
    if (slots.has('prepend') || slots.has('append')) return true;
    return attrs.entries().some(([name]) => TAB_ACCESSORY_ATTRIBUTES.has(name));
}

function prepareTab({ part, attrs, slots }) {
    const composed = tabHasAccessories(attrs, slots);
    if (!composed) return { composed: false };

    if (VOID_ELEMENTS.has(part.tagName)) {
        throw new Error(
            "Component 'tabs' tab accessories require a non-void x-part='tab' host; use a button, link, or other container element.",
        );
    }

    prepareItemPrepend(attrs, slots, { keyPrefix: 'tabs:tab' });
    prepareItemAppend(attrs, slots, { keyPrefix: 'tabs:tab' });
    return { composed: true };
}

function renderTab(context) {
    if (!context.view.composed) return context.renderDefault();

    const { attrs, slots } = context;
    const prepend = slots.has('prepend')
        ? renderElement('span', attrs.for('prepend'), slots.get('prepend').html())
        : '';
    const append = slots.has('append')
        ? renderElement('span', attrs.for('append'), slots.get('append').html())
        : '';

    return `${prepend}${slots.get('default').html()}${append}`;
}

const tabPart = Object.freeze({
    prepare: prepareTab,
    render: renderTab,
});

function normalizedName(value) {
    return String(value ?? '').trim();
}

function idToken(value) {
    const token = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return token || 'item';
}

function contribute(part, attributes) {
    const managed = AttributeBag.from(attributes);
    part.attrs = managed.merge(part.attrs);
    part.managedAttributes = managed.merge(part.managedAttributes);
}

function previousElementPosition(nodes, position) {
    for (let index = position - 1; index >= 0; index -= 1) {
        if (nodes[index]?.nodeType === Node.ELEMENT_NODE) return index;
    }
    return -1;
}

export class Tabs extends Component {
    static structural = true;

    static parts = {
        tab: tabPart,
        'tab-content': {},
    };

    mount() {
        this.generatedId = `x-isas-tabs-${++nextTabsId}`;
        this.controller = new TabsController(this);
        this.controller.mount();
        this.modelEffectStarted = false;
        this.syncingHost = false;

        this.listen(this.el, 'click', (event) => this.clicked(event));
        this.listen(this.el, 'keydown', (event) => this.keydown(event));
    }

    get managed() {
        return this.controller?.managed ?? false;
    }

    baseId() {
        return this.controller?.id || this.generatedId;
    }

    activationMode() {
        return String(this.attrs?.get('activation') ?? 'automatic').toLowerCase() === 'manual'
            ? 'manual'
            : 'automatic';
    }

    visibilityMode() {
        return String(this.attrs?.get('visibility') ?? 'automatic').toLowerCase() === 'manual'
            ? 'manual'
            : 'automatic';
    }

    orientation() {
        return String(this.attrs?.get('aria-orientation') ?? 'horizontal').toLowerCase() === 'vertical'
            ? 'vertical'
            : 'horizontal';
    }

    prepareRender() {
        const tabs = this.parts.parts.filter((part) => part.name === 'tab');
        const panels = this.parts.parts.filter((part) => part.name === 'tab-content');
        const nodes = this.source.childNodes();
        const tabByPosition = new Map(tabs.map((part) => [part.position, part]));
        const panelByTab = new Map();

        for (const panel of panels) {
            const previous = previousElementPosition(nodes, panel.position);
            const tab = tabByPosition.get(previous);
            if (!tab) {
                throw new Error(
                    "Component 'tabs' requires each x-part='tab-content' to immediately follow an x-part='tab'.",
                );
            }
            if (panelByTab.has(tab)) {
                throw new Error("Component 'tabs' accepts only one local tab-content per tab.");
            }
            panelByTab.set(tab, panel);
        }

        const records = tabs.map((part) => {
            const panel = panelByTab.get(part) ?? null;
            const tabName = normalizedName(part.attrs.get('name'));
            const panelName = normalizedName(panel?.attrs.get('name'));
            if (panel && Boolean(tabName) !== Boolean(panelName)) {
                throw new Error(
                    "Component 'tabs' local tab and tab-content must both declare name or both omit it.",
                );
            }
            if (panel && tabName && tabName !== panelName) {
                throw new Error(
                    `Component 'tabs' local tab name '${tabName}' does not match tab-content name '${panelName}'.`,
                );
            }
            const name = tabName || `@${part.index}`;
            const token = idToken(tabName || part.index + 1);
            const id = normalizedName(part.attrs.get('id'))
                || `${this.baseId()}-tab-${token}`;
            const panelId = panel
                ? normalizedName(panel.attrs.get('id'))
                    || `${this.baseId()}-panel-local-${token}`
                : null;
            return {
                name,
                explicitName: Boolean(tabName),
                part,
                panel,
                id,
                panelId,
                disabled: part.attrs.boolean('disabled')
                    || String(part.attrs.get('aria-disabled')).toLowerCase() === 'true',
                authoredActive: part.attrs.boolean('active')
                    || part.attrs.boolean('checked')
                    || String(part.attrs.get('aria-selected')).toLowerCase() === 'true',
                radio: part.tagName === 'input'
                    && String(part.attrs.get('type')).toLowerCase() === 'radio',
            };
        });

        this.controller.setTabs(records, panels.length);
        if (this.managed) {
            this.validateManagedTabs(records);
            this.controller.ensureInitialized();
            this.applyManagedParts(records);
        }
        return { managed: this.managed };
    }

    applyManagedParts(records) {
        for (const record of records) {
            const active = this.controller.isSelected(record.name);
            const controls = [
                record.panelId,
                ...this.controller.panelIds(record.name),
            ].filter(Boolean);
            contribute(record.part, {
                id: record.id,
                role: 'tab',
                ...(record.part.tagName === 'button' && !record.part.attrs.has('type')
                    ? { type: 'button' }
                    : {}),
                tabindex: active ? '0' : '-1',
                'aria-selected': active ? 'true' : 'false',
                'aria-controls': controls.length ? controls.join(' ') : false,
                'aria-disabled': record.disabled ? 'true' : false,
                'data-isas-tab-state': this.controller.memberState(record.name),
                'data-isas-tab-position': this.controller.position(record.name),
            });

            if (!record.panel) continue;
            const panelAttributes = {
                id: record.panelId,
                role: 'tabpanel',
                'aria-labelledby': record.id,
                'aria-hidden': active ? 'false' : 'true',
                'data-isas-tab-state': this.controller.memberState(record.name),
                'data-isas-tab-position': this.controller.position(record.name),
            };
            if (this.visibilityMode() === 'automatic') panelAttributes.hidden = !active;
            contribute(record.panel, panelAttributes);
        }
    }

    validateManagedTabs(records = this.controller.tabs) {
        const duplicate = records.find((record, index) => (
            records.findIndex((candidate) => candidate.name === record.name) !== index
        ));
        if (duplicate) {
            throw new Error(`Component 'tabs' requires unique tab name '${duplicate.name}'.`);
        }
        if (records.some((record) => record.radio)) {
            throw new Error(
                "Component 'tabs' does not support radio inputs in managed mode; use buttons or links.",
            );
        }
        if (this.hasModelBinding() && records.some((record) => !record.explicitName)) {
            throw new Error("Component 'tabs' requires named tabs when using x-model or wire:model.");
        }
        if (this.controller.linked && records.some((record) => !record.explicitName)) {
            throw new Error("Component 'tabs' requires named tabs when linked to tab-panels.");
        }
        const active = records.filter((record) => record.authoredActive);
        if (!this.hasModelBinding() && !this.attrs.has('value') && active.length > 1) {
            throw new Error("Component 'tabs' accepts only one initial active tab.");
        }
    }

    initialValue(records = this.controller.tabs) {
        const model = this.el._x_model;
        if (model) return normalizedName(model.get());
        if (this.attrs.has('value')) return normalizedName(this.attrs.get('value'));
        return records.find((record) => record.authoredActive)?.name ?? '';
    }

    hasModelBinding() {
        return Boolean(this.el._x_model)
            || this.el.hasAttribute('x-model')
            || this.el.getAttributeNames().some((name) => (
                name === 'wire:model' || name.startsWith('wire:model.')
            ));
    }

    startModelEffect() {
        if (this.modelEffectStarted || !this.el._x_model || !globalThis.Alpine?.effect) return;
        this.modelEffectStarted = true;
        const runner = globalThis.Alpine.effect(() => {
            const value = normalizedName(this.el._x_model?.get());
            if (this.syncingHost || !this.controller.initialized) return;
            this.controller.select(value, { dispatch: false });
        });
        this.onCleanup(() => globalThis.Alpine.release?.(runner));
    }

    syncHostValue() {
        this.el.value = this.controller.state.value;
    }

    commitSelection({ dispatch = true } = {}) {
        this.syncingHost = true;
        this.syncHostValue();
        try {
            if (dispatch) {
                this.el.dispatchEvent(new Event('input', { bubbles: true }));
                this.el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } finally {
            this.syncingHost = false;
        }
    }

    directTabElements() {
        return [...this.el.children].filter((element) => (
            element.getAttribute('x-part') === 'tab'
        ));
    }

    tabFromEvent(event) {
        const element = event.target.closest?.('[x-part="tab"]');
        if (!element || element.parentElement !== this.el) return null;
        const index = this.directTabElements().indexOf(element);
        const record = this.controller.tabs[index];
        return record ? { element, record, index } : null;
    }

    clicked(event) {
        const match = this.tabFromEvent(event);
        if (!match || !this.managed || match.record.disabled) return;
        event.preventDefault();
        this.controller.select(match.record.name, { source: match.element });
    }

    keydown(event) {
        const match = this.tabFromEvent(event);
        if (!match || !this.managed || match.record.disabled) return;
        const vertical = this.orientation() === 'vertical';
        let action = null;
        if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) action = 'next';
        if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) action = 'previous';
        if (event.key === 'Home') action = 'first';
        if (event.key === 'End') action = 'last';

        if (action) {
            event.preventDefault();
            const enabled = this.controller.enabledTabs();
            if (!enabled.length) return;
            const current = enabled.findIndex((tab) => tab.name === match.record.name);
            let target;
            if (action === 'first') target = enabled[0];
            else if (action === 'last') target = enabled.at(-1);
            else {
                const step = action === 'next' ? 1 : -1;
                target = enabled[(current + step + enabled.length) % enabled.length];
            }
            const targetIndex = this.controller.tabs.indexOf(target);
            this.directTabElements()[targetIndex]?.focus({ preventScroll: true });
            if (this.activationMode() === 'automatic') {
                this.controller.select(target.name, {
                    direction: action === 'next' || action === 'previous' ? action : null,
                    source: this.directTabElements()[targetIndex],
                });
            }
            return;
        }

        if (this.activationMode() === 'manual' && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            this.controller.select(match.record.name, { source: match.element });
        }
    }

    mergeScope() {
        return {
            get value() { return this.controller.state.value; },
            set value(value) { this.controller.select(value); },
            get previousValue() { return this.controller.state.previousValue; },
            get selectedIndex() { return this.controller.state.selectedIndex; },
            get previousIndex() { return this.controller.state.previousIndex; },
            get direction() { return this.controller.state.direction; },
            get managed() { return this.controller.managed; },
            get linked() { return this.controller.linked; },
            get activation() { return this.activationMode(); },
            select: this.controller.select.bind(this.controller),
            isSelected: this.controller.isSelected.bind(this.controller),
            position: this.controller.position.bind(this.controller),
            next: this.controller.next.bind(this.controller),
            previous: this.controller.previous.bind(this.controller),
            first: this.controller.first.bind(this.controller),
            last: this.controller.last.bind(this.controller),
        };
    }

    hostAttributes() {
        if (!this.managed) return {};
        return {
            role: 'tablist',
            'aria-orientation': this.orientation() === 'vertical' ? 'vertical' : false,
            'data-isas-tabs-managed': '',
            'data-isas-tabs-direction': this.controller.state.direction,
            'data-isas-tabs-visibility': this.visibilityMode(),
        };
    }

    render() {
        const parts = new Map(this.parts.ordered().map((part) => [part.position, part]));
        return this.source.childNodes().map((node, position) => (
            parts.has(position) ? parts.get(position).html(this) : serializeNode(node)
        )).join('');
    }

    attributeChanged(name) {
        if (name === 'id') this.controller.reconcileRegistration();
        if (['activation', 'visibility', 'value', 'aria-orientation'].includes(name)) {
            if (name === 'value' && this.controller.initialized && !this.el._x_model) {
                this.controller.select(this.attrs.get('value'));
            }
            this.requestRender();
        }
    }

    sourceChanged() {
        this.controller.reconcileRegistration();
    }

    destroy() {
        this.controller?.destroy();
    }
}
