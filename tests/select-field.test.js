import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    HostRuntime,
    Isas,
    SelectField,
    selectFieldAdapter,
} from '../src/index.js';

const tick = async () => {
    await Promise.resolve();
    await Alpine.nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
};

function resize(width, height = 768) {
    Object.defineProperties(window, {
        innerWidth: { configurable: true, value: width },
        innerHeight: { configurable: true, value: height },
    });
    window.dispatchEvent(new Event('resize'));
}

function mount(html) {
    document.body.innerHTML = html;
    Alpine.initTree(document.body);
    return document.body.firstElementChild;
}

beforeAll(() => {
    globalThis.Alpine = Alpine;
    Alpine.plugin(morph);
    Alpine.plugin(isas);
});

afterEach(async () => {
    Alpine.destroyTree(document.body);
    document.body.replaceChildren();
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('select-field composition and routing', () => {
    it('registers the component and DaisyUI adapter', () => {
        expect(Isas.components.get('select-field')).toBe(SelectField);
        expect(Isas.adapters.get('select-field')).toBe(selectFieldAdapter);
    });

    it('generates a styled Select and forwards options, props, and native attributes', async () => {
        const host = mount(`
            <div x-is="select-field" id="owner-field" class="authored-field"
                label="Owner" label:append="Required" support="Choose one person"
                name="owner" required searchable icon="i-tabler-user"
                native:id="exact-native" select:placeholder="Choose owner">
                <div x-is="option" value="ada" label="Ada Lovelace"></div>
                <div x-is="option" value="grace" label="Grace Hopper"></div>
            </div>
        `);
        await tick();
        await tick();

        const select = host.querySelector('[data-isas-select-field-select]');
        const trigger = select.querySelector('[data-isas-select-trigger]');
        const native = select.querySelector('[data-isas-select-control]');
        const label = host.querySelector('[data-isas-select-field-label]');
        const support = host.querySelector('[data-isas-select-field-support]');

        expect(host.classList.contains('authored-field')).toBe(true);
        expect(select.getAttribute('x-is')).toBe('select');
        expect(select.querySelectorAll('[x-is="option"]')).toHaveLength(2);
        expect(select.getAttribute('label')).toBe('Owner');
        expect(select.getAttribute('placeholder')).toBe('Choose owner');
        expect(native.id).toBe('exact-native');
        expect(native.name).toBe('owner');
        expect(native.required).toBe(true);
        expect(trigger.id).toBe('owner-field-control');
        expect(label.htmlFor).toBe(trigger.id);
        expect(label.textContent).toBe('OwnerRequired');
        expect(trigger.getAttribute('aria-describedby')).toBe(support.id);
    });

    it('keeps root field sizing while allowing a Select-only size override', async () => {
        const host = mount(`
            <div x-is="select-field" size="lg" select:size="xs" layout="inline"
                label="Owner" support="Choose one">
                <div x-is="option" value="ada">Ada</div>
            </div>
        `);
        await tick();
        await tick();

        expect(host.dataset.size).toBe('lg');
        expect(host.dataset.layout).toBe('inline');
        expect(host.classList.contains('grid-cols-2')).toBe(true);
        expect(host.querySelector('[data-isas-select-field-label]').classList
            .contains('text-lg')).toBe(true);
        expect(host.querySelector('[data-isas-select-trigger]').classList
            .contains('input-xs')).toBe(true);
    });

    it.each([
        ['xs', 'text-xs', 'text-xs', 'gap-y-1', 'gap-x-2', 'input-xs'],
        ['sm', 'text-sm', 'text-xs', 'gap-y-1', 'gap-x-3', 'input-sm'],
        ['md', 'text-base', 'text-sm', 'gap-y-1.5', 'gap-x-4', 'input-md'],
        ['lg', 'text-lg', 'text-base', 'gap-y-2', 'gap-x-5', 'input-lg'],
        ['xl', 'text-xl', 'text-lg', 'gap-y-3', 'gap-x-6', 'input-xl'],
    ])('scales every field region for %s', async (
        size, labelClass, metadataClass, rowGap, columnGap, selectClass,
    ) => {
        const host = mount(`
            <div x-is="select-field" size="${size}" layout="inline"
                label="Owner" label:append="Optional" support="Help"
                support:append="Meta" error="Invalid">
                <div x-is="option" value="ada">Ada</div>
            </div>
        `);
        await tick();
        await tick();
        expect(host.dataset.size).toBe(size);
        expect(host.classList.contains(rowGap)).toBe(true);
        expect(host.classList.contains(columnGap)).toBe(true);
        expect(host.querySelector('[data-isas-select-field-label]').classList
            .contains(labelClass)).toBe(true);
        expect(host.querySelector('[data-isas-select-field-support]').classList
            .contains(metadataClass)).toBe(true);
        expect(host.querySelector('[data-isas-select-field-error]').classList
            .contains(metadataClass)).toBe(true);
        expect(host.querySelector('[data-isas-select-trigger]').classList
            .contains(selectClass)).toBe(true);
    });

    it('reactively normalizes size and layout without leaving stale classes', async () => {
        const root = mount(`
            <div x-data="{ size: 'invalid', layout: 'adaptive' }">
                <div x-is="select-field" :size="size" :layout="layout"
                    breakpoint="xl" label="Owner" support="Help">
                    <div x-is="option" value="ada">Ada</div>
                </div>
            </div>
        `);
        await tick();
        await tick();
        const host = root.querySelector('[x-is="select-field"]');
        expect(host.dataset.size).toBe('md');
        expect(host.dataset.layout).toBe('stacked');
        expect(host.getAttribute('breakpoint')).toBe('xl');
        expect(host.hasAttribute('data-breakpoint')).toBe(false);

        Alpine.$data(root).size = 'xl';
        Alpine.$data(root).layout = 'inline';
        await tick();
        await tick();
        expect(host.dataset.size).toBe('xl');
        expect(host.dataset.layout).toBe('inline');
        expect(host.classList.contains('gap-y-3')).toBe(true);
        expect(host.classList.contains('gap-y-1.5')).toBe(false);
        expect(host.querySelector('[data-isas-select-trigger]').classList
            .contains('input-xl')).toBe(true);
        expect(host.querySelector('[data-isas-select-trigger]').classList
            .contains('input-md')).toBe(false);
    });

    it('leaves responsive layout changes to $display.mobile', async () => {
        resize(767);
        const root = mount(`
            <div x-data>
                <div x-is="select-field"
                    :layout="$display.mobile ? 'stacked' : 'inline'" label="Owner">
                    <div x-is="option" value="ada">Ada</div>
                </div>
            </div>
        `);
        await tick();
        const host = root.querySelector('[x-is="select-field"]');
        expect(host.dataset.layout).toBe('stacked');
        resize(1024);
        await tick();
        expect(host.dataset.layout).toBe('inline');
    });

    it('preserves custom part order and an authored styled Select', async () => {
        const host = mount(`
            <div x-is="select-field" error="Rejected">
                <small x-part="support">Before</small>
                <div x-part="control">
                    <div x-is="select:owner" trigger:id="authored-trigger">
                        <div x-is="option" value="a">A</div>
                    </div>
                </div>
                <label x-part="label">After</label>
                <p x-part="error"><strong>Custom error</strong></p>
            </div>
        `);
        await tick();
        await tick();

        expect([...host.children].map((element) => (
            ['label', 'control', 'support', 'error'].find((name) => (
                element.hasAttribute(`data-isas-select-field-${name}`)
            ))
        ))).toEqual(['support', 'control', 'label', 'error']);
        expect(host.querySelector('[data-isas-select-trigger]').id).toBe('authored-trigger');
        expect(host.querySelector('[data-isas-select-field-error]').textContent)
            .toBe('Custom error');
    });

    it.each([
        `<div x-is="select-field"><div x-part="label"></div></div>`,
        `<div x-is="select-field"><div x-part="control"><div x-as="select"></div></div></div>`,
        `<div x-is="select-field"><div x-part="control"><div x-is="select"></div></div><div x-is="option"></div></div>`,
    ])('rejects invalid custom composition', (html) => {
        expect(() => mount(html)).toThrow();
    });
});

describe('select-field validation and scope bridge', () => {
    it('externalizes native and string validation without changing standalone Select', async () => {
        const form = mount(`
            <form>
                <div x-is="select-field" id="field" label="Owner" support="Required"
                    name="owner" required>
                    <div x-is="option" value="ada">Ada</div>
                </div>
                <div id="standalone" x-is="select" name="standalone" required>
                    <div x-is="option" value="a">A</div>
                </div>
            </form>
        `);
        await tick();
        await tick();

        const field = form.querySelector('[x-is="select-field"]');
        const select = field.querySelector('[data-isas-select-field-select]');
        const trigger = select.querySelector('[data-isas-select-trigger]');
        const state = Alpine.$data(field).$select;
        expect(state.showError()).toBe(false);
        await tick();
        await tick();

        const support = field.querySelector('[data-isas-select-field-support]');
        const error = field.querySelector('[data-isas-select-field-error]');
        expect(error).not.toBeNull();
        expect(error.hidden).toBe(false);
        expect(select.querySelector('[data-isas-select-error]')).toBeNull();
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(trigger.getAttribute('aria-describedby').split(/\s+/))
            .toEqual([support.id, error.id]);

        expect(state.setCustomValidity('Choose an owner')).toBe(true);
        await tick();
        await tick();
        expect(field.querySelector('[data-isas-select-field-error]').textContent)
            .toBe('Choose an owner');
        expect(state.setCustomValidity('')).toBe(true);
        expect(state.select('ada')).toBe(true);
        await tick();
        await tick();
        expect(field.querySelector('[data-isas-select-field-error]').hidden).toBe(true);
        expect(trigger.hasAttribute('aria-invalid')).toBe(false);
        expect(trigger.getAttribute('aria-describedby')).toBe(support.id);

        const standalone = form.querySelector('#standalone');
        expect(Alpine.$data(standalone).$select.showError()).toBe(false);
        await tick();
        expect(standalone.querySelector('[data-isas-select-error]')).not.toBeNull();
    });

    it('keeps boolean invalid styling with an empty authoritative field region', async () => {
        const host = mount(`
            <div x-is="select-field" label="Owner" error>
                <div x-is="option" value="ada">Ada</div>
            </div>
        `);
        await tick();
        await tick();
        const error = host.querySelector('[data-isas-select-field-error]');
        expect(error.hidden).toBe(false);
        expect(error.textContent).toBe('');
        expect(host.querySelector('[data-isas-select-trigger]')
            .getAttribute('aria-invalid')).toBe('true');
        expect(host.querySelector('[data-isas-select-error]')).toBeNull();
    });

    it('preserves exact and Alpine-generated trigger IDs and routed Livewire aliases', async () => {
        const root = mount(`
            <div>
                <div x-is="select-field" label="Exact" trigger:id="exact-trigger"
                    native:id="exact-native" select:lw:model.live="owner">
                    <div x-is="option" value="ada">Ada</div>
                </div>
                <div x-data x-id="['owner-trigger']" x-is="select-field"
                    label="Alpine" trigger::id="$id('owner-trigger')">
                    <div x-is="option" value="ada">Ada</div>
                </div>
            </div>
        `);
        await tick();
        await tick();
        const [exact, dynamic] = root.querySelectorAll('[x-is="select-field"]');
        expect(exact.querySelector('[data-isas-select-trigger]').id).toBe('exact-trigger');
        expect(exact.querySelector('[data-isas-select-control]').id).toBe('exact-native');
        expect(exact.querySelector('[data-isas-select-field-label]').htmlFor)
            .toBe('exact-trigger');
        expect(exact.querySelector('[data-isas-select-field-select]')
            .getAttribute('wire:model.live')).toBe('owner');
        const dynamicTrigger = dynamic.querySelector('[data-isas-select-trigger]');
        expect(dynamicTrigger.id).toMatch(/^owner-trigger-/);
        expect(dynamic.querySelector('[data-isas-select-field-label]').htmlFor)
            .toBe(dynamicTrigger.id);
    });

    it('exposes one stable live Select proxy through both field paths', async () => {
        const host = mount(`
            <div x-is="select-field" label="Owner" support="Actions">
                <div x-is="option" value="ada">Ada</div>
                <div x-is="option" value="grace">Grace</div>
            </div>
        `);
        await tick();
        await tick();

        const data = Alpine.$data(host);
        const proxy = data.$select;
        expect(proxy).toBe(data.$selectField.select);
        expect(proxy.select('grace')).toBe(true);
        await tick();
        expect(proxy.value).toBe('grace');
        expect(proxy.selectedCount).toBe(1);
        expect(proxy.clear()).toBe(true);
        expect(proxy.value).toBe('');
        expect(data.$select).toBe(proxy);
    });

    it('stages early writes and disconnects stale targets', async () => {
        const host = mount(`
            <div x-is="select-field" label="Owner">
                <div x-is="option" value="ada">Ada</div>
            </div>
        `);
        await tick();
        await tick();
        const proxy = Alpine.$data(host).$select;
        HostRuntime.from(host).component.scopeBridge.disconnect();
        proxy.value = 'ada';
        expect(proxy.clear()).toBe(false);
        host.setAttribute('data-reconnect', 'true');
        await tick();
        await tick();
        expect(proxy.value).toBe('ada');

        Alpine.destroyTree(host);
        expect(proxy.clear()).toBe(false);
    });

    it('retargets the stable proxy through authored control reconciliation', async () => {
        const host = mount(`
            <div x-is="select-field:ownerField" label="Owner">
                <label x-part="label"></label>
                <div x-part="control">
                    <div x-is="select:first" marker="first">
                        <div x-is="option" value="ada">Ada</div>
                    </div>
                </div>
            </div>
        `);
        await tick();
        await tick();
        const data = Alpine.$data(host);
        const proxy = data.$select;
        expect(proxy).toBe(data.ownerField.select);
        expect(proxy.marker).toBe('first');

        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'select-field:ownerField');
        incoming.setAttribute('label', 'Updated owner');
        incoming.innerHTML = `
            <label x-part="label"></label>
            <div x-part="control">
                <div x-is="select:second" marker="second">
                    <div x-is="option" value="grace">Grace</div>
                </div>
            </div>
        `;
        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();
        await tick();
        expect(Alpine.$data(host).$select).toBe(proxy);
        expect(proxy.marker).toBe('second');
        expect(proxy.select('grace')).toBe(true);
        expect(proxy.value).toBe('grace');
    });
});
