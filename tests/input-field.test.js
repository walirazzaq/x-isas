import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, {
    HostRuntime,
    InputField,
    inputFieldAdapter,
    Isas,
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

function native(host) {
    return host.querySelector('[data-isas-input-field-input] [data-isas-input-native]');
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

describe('input-field shorthand and routing', () => {
    it('registers the component and DaisyUI adapter', () => {
        expect(Isas.components.get('input-field')).toBe(InputField);
        expect(Isas.adapters.get('input-field')).toBe(inputFieldAdapter);
    });

    it('renders canonical regions and routes known attributes into Input', async () => {
        const host = mount(`
            <div x-is="input-field" id="account" class="authored-field"
                label="Email" label:prepend="@" label:append="Optional"
                support="Use your work address" support:prepend="Hint"
                type="email" name="email" placeholder="person@example.com"
                icon="i-mail" clearable input:class="authored-input"
                native:autocomplete="email" data-owner="profile"></div>
        `);
        await tick();

        const regions = [...host.children].map((element) => (
            ['label', 'control', 'support', 'error'].find((name) => (
                element.hasAttribute(`data-isas-input-field-${name}`)
            ))
        ));
        expect(regions).toEqual(['label', 'control', 'support']);
        expect(host.id).toBe('account');
        expect(host.classList.contains('authored-field')).toBe(true);
        expect(host.dataset.owner).toBe('profile');

        const inputHost = host.querySelector('[data-isas-input-field-input]');
        const control = native(host);
        expect(inputHost.classList.contains('authored-input')).toBe(true);
        expect(inputHost.classList.contains('i-mail')).toBe(false);
        expect(inputHost.querySelector('.i-mail')).not.toBeNull();
        expect(control.id).toBe('account-control');
        expect(control.type).toBe('email');
        expect(control.name).toBe('email');
        expect(control.placeholder).toBe('person@example.com');
        expect(control.autocomplete).toBe('email');
        expect(host.querySelector('[data-isas-input-field-label]').textContent)
            .toBe('@EmailOptional');
        expect(host.querySelector('[data-isas-input-field-support]').textContent)
            .toBe('HintUse your work address');
    });

    it('prefers authored metadata slots and escapes shorthand content', async () => {
        const shorthand = mount(`
            <div x-is="input-field" label="&lt;Unsafe&gt;" support="A &amp; B"></div>
        `);
        await tick();
        expect(shorthand.querySelector('[data-isas-input-field-label]').innerHTML)
            .toContain('&lt;Unsafe&gt;');
        expect(shorthand.querySelector('[data-isas-input-field-support]').textContent)
            .toBe('A & B');

        Alpine.destroyTree(shorthand);
        document.body.replaceChildren();
        const custom = mount(`
            <div x-is="input-field" label="Ignored" support="Ignored">
                <label x-part="label" prepend="Ignored">
                    <strong slot="prepend">Custom prepend</strong>
                    <span>Custom label</span>
                    <em slot="append">Custom append</em>
                </label>
                <div x-part="control"></div>
                <small x-part="support"><b>Custom support</b></small>
            </div>
        `);
        await tick();
        expect(custom.querySelector('[data-isas-input-field-label]').textContent)
            .toBe('Custom prependCustom labelCustom append');
        expect(custom.querySelector('[data-isas-input-field-support]').textContent)
            .toBe('Custom support');
        expect(custom.textContent).not.toContain('Ignored');
    });
});

describe('input-field parts and layouts', () => {
    it('preserves custom region order and an authored nested Input/native part', async () => {
        const host = mount(`
            <section x-is="input-field" error="Rejected" native:name="root">
                <small x-part="support">Before control</small>
                <div x-part="control">
                    <label x-is="input:query" class="authored-shell" native:placeholder="Child">
                        <input x-part="native" id="exact-control" name="authored">
                    </label>
                </div>
                <label x-part="label">After control</label>
                <p x-part="error"><strong>Custom error</strong></p>
            </section>
        `);
        await tick();

        expect([...host.children].map((element) => (
            REGION(element)
        ))).toEqual(['support', 'control', 'label', 'error']);
        expect(native(host).id).toBe('exact-control');
        expect(native(host).name).toBe('authored');
        expect(native(host).placeholder).toBe('Child');
        expect(host.querySelector('[data-isas-input-field-input]').classList
            .contains('authored-shell')).toBe(true);
        expect(host.querySelector('[data-isas-input-field-error]').textContent)
            .toBe('Custom error');
    });

    it.each([
        [
            `<div x-is="input-field"><div x-part="label"></div></div>`,
            "requires one x-part='control'",
        ],
        [
            `<div x-is="input-field"><div x-part="control"></div><div x-part="control"></div></div>`,
            "allows only one x-part='control'",
        ],
        [
            `<div x-is="input-field"><div x-part="control"><input></div></div>`,
            "must be empty or contain exactly one x-is='input'",
        ],
    ])('rejects invalid custom composition', (html, message) => {
        expect(() => mount(html)).toThrow(message);
    });

    it.each([
        ['xs', 'input-xs', 'text-xs', 'text-xs', 'gap-y-1', 'gap-x-2', 'gap-1'],
        ['sm', 'input-sm', 'text-sm', 'text-xs', 'gap-y-1', 'gap-x-3', 'gap-1.5'],
        ['md', 'input-md', 'text-base', 'text-sm', 'gap-y-1.5', 'gap-x-4', 'gap-2'],
        ['lg', 'input-lg', 'text-lg', 'text-base', 'gap-y-2', 'gap-x-5', 'gap-2.5'],
        ['xl', 'input-xl', 'text-xl', 'text-lg', 'gap-y-3', 'gap-x-6', 'gap-3'],
    ])('applies the %s scale to every field region', async (
        size,
        inputClass,
        labelClass,
        metadataClass,
        rowGap,
        columnGap,
        accessoryGap,
    ) => {
        const host = mount(`
            <div x-is="input-field" size="${size}" layout="inline"
                label="Name" label:append="Optional"
                support="Helpful context" support:prepend="Hint"
                error="Invalid value"></div>
        `);
        await tick();

        const label = host.querySelector('[data-isas-input-field-label]');
        const support = host.querySelector('[data-isas-input-field-support]');
        const error = host.querySelector('[data-isas-input-field-error]');
        const input = host.querySelector('[data-isas-input-field-input]');

        expect(host.dataset.size).toBe(size);
        expect(host.classList.contains(rowGap)).toBe(true);
        expect(host.classList.contains(columnGap)).toBe(true);
        expect(label.classList.contains(labelClass)).toBe(true);
        expect(label.classList.contains(accessoryGap)).toBe(true);
        expect(support.classList.contains(metadataClass)).toBe(true);
        expect(support.classList.contains(accessoryGap)).toBe(true);
        expect(error.classList.contains(metadataClass)).toBe(true);
        expect(input.classList.contains(inputClass)).toBe(true);
    });

    it('normalizes the root size while preserving control-specific overrides', async () => {
        const defaultField = mount(`
            <div x-is="input-field" label="Default" support="Metadata"></div>
        `);
        await tick();
        expect(defaultField.dataset.size).toBe('md');
        expect(defaultField.classList.contains('gap-y-1.5')).toBe(true);
        expect(defaultField.querySelector('[data-isas-input-field-label]').classList
            .contains('text-base')).toBe(true);
        expect(defaultField.querySelector('[data-isas-input-field-input]').classList
            .contains('input-md')).toBe(true);

        Alpine.destroyTree(defaultField);
        document.body.replaceChildren();
        const routed = mount(`
            <div x-is="input-field" size="invalid" input:size="xl"
                label="Fallback" support="Metadata"></div>
        `);
        await tick();
        expect(routed.dataset.size).toBe('md');
        expect(routed.querySelector('[data-isas-input-field-label]').classList
            .contains('text-base')).toBe(true);
        expect(routed.querySelector('[data-isas-input-field-input]').classList
            .contains('input-xl')).toBe(true);
        expect(routed.querySelector('[data-isas-input-field-input]').classList
            .contains('input-md')).toBe(false);

        Alpine.destroyTree(routed);
        document.body.replaceChildren();
        const authored = mount(`
            <div x-is="input-field" size="lg">
                <label x-part="label">Authored</label>
                <div x-part="control"><label x-is="input" size="xs"></label></div>
            </div>
        `);
        await tick();
        expect(authored.dataset.size).toBe('lg');
        expect(authored.querySelector('[data-isas-input-field-label]').classList
            .contains('text-lg')).toBe(true);
        expect(authored.querySelector('[data-isas-input-field-input]').classList
            .contains('input-xs')).toBe(true);
    });

    it('reactively replaces field-wide size and layout spacing classes', async () => {
        const root = mount(`
            <div x-data="{ size: 'xs', layout: 'stacked' }">
                <div x-is="input-field" label="Name" support="Help" error="Invalid"
                    :size="size" :layout="layout"></div>
            </div>
        `);
        await tick();
        const host = root.querySelector('[x-is="input-field"]');
        expect(host.dataset.size).toBe('xs');
        expect(host.classList.contains('gap-y-1')).toBe(true);
        expect(host.querySelector('[data-isas-input-field-input]').classList
            .contains('input-xs')).toBe(true);

        Alpine.$data(root).size = 'xl';
        Alpine.$data(root).layout = 'inline';
        await tick();
        expect(host.dataset.size).toBe('xl');
        expect(host.classList.contains('gap-y-3')).toBe(true);
        expect(host.classList.contains('gap-x-6')).toBe(true);
        expect(host.classList.contains('gap-y-1')).toBe(false);
        const classes = (selector) => {
            const element = host.querySelector(selector);
            const value = [...element.attributes].find(({ name }) => name === 'class').value;
            return new Set(value.split(/\s+/));
        };
        expect(classes('[data-isas-input-field-label]').has('text-xl')).toBe(true);
        expect(classes('[data-isas-input-field-label]').has('text-xs')).toBe(false);
        expect(classes('[data-isas-input-field-support]').has('text-lg')).toBe(true);
        expect(classes('[data-isas-input-field-error]').has('text-xs')).toBe(false);
        expect(classes('[data-isas-input-field-input]').has('input-xl')).toBe(true);
        expect(classes('[data-isas-input-field-input]').has('input-xs')).toBe(false);
    });

    it('supports stacked and inline while treating adaptive as stacked', async () => {
        const root = mount(`
            <div x-data="{ layout: 'stacked' }">
                <div x-is="input-field" label="Name" support="Help"
                    :layout="layout" breakpoint="xl"></div>
            </div>
        `);
        await tick();
        const host = root.querySelector('[x-is="input-field"]');
        expect(host.dataset.layout).toBe('stacked');
        expect(host.classList.contains('flex')).toBe(true);
        expect(host.getAttribute('breakpoint')).toBe('xl');
        expect(host.hasAttribute('data-breakpoint')).toBe(false);
        expect(host.classList.contains('xl:grid-cols-2')).toBe(false);

        Alpine.$data(root).layout = 'inline';
        await tick();
        expect(host.dataset.layout).toBe('inline');
        expect(host.classList.contains('grid-cols-2')).toBe(true);
        expect(host.classList.contains('flex')).toBe(false);

        Alpine.$data(root).layout = 'adaptive';
        await tick();
        expect(host.dataset.layout).toBe('stacked');
        expect(host.hasAttribute('data-breakpoint')).toBe(false);
        expect(host.classList.contains('flex')).toBe(true);
        expect(host.classList.contains('grid-cols-2')).toBe(false);
    });

    it('leaves responsive layout switching to the $display magic', async () => {
        resize(767, 600);
        const root = mount(`
            <div x-data>
                <div x-is="input-field" label="Name" support="Help"
                    :layout="$display.mobile ? 'stacked' : 'inline'"></div>
            </div>
        `);
        await tick();
        const host = root.querySelector('[x-is="input-field"]');
        expect(host.dataset.layout).toBe('stacked');
        expect(host.classList.contains('flex')).toBe(true);

        resize(1024, 768);
        await tick();
        expect(host.dataset.layout).toBe('inline');
        expect(host.classList.contains('grid-cols-2')).toBe(true);
        expect(host.classList.contains('flex')).toBe(false);
    });
});

describe('input-field validation and accessibility', () => {
    it('keeps support and string errors visible and updates describedby', async () => {
        const host = mount(`
            <div x-is="input-field" id="email-field" label="Email"
                support="Required for receipts" error="Server rejected email"></div>
        `);
        await tick();
        const control = native(host);
        const label = host.querySelector('[data-isas-input-field-label]');
        const support = host.querySelector('[data-isas-input-field-support]');
        const error = host.querySelector('[data-isas-input-field-error]');
        expect(label.htmlFor).toBe(control.id);
        expect(control.id).toBe('email-field-control');
        expect(support.hidden).toBe(false);
        expect(error.hidden).toBe(false);
        expect(error.textContent).toBe('Server rejected email');
        expect(control.getAttribute('aria-invalid')).toBe('true');
        expect(control.getAttribute('aria-describedby').split(/\s+/))
            .toEqual([support.id, error.id]);

        host.removeAttribute('error');
        await tick();
        expect(host.querySelector('[data-isas-input-field-error]')).toBeNull();
        expect(native(host).getAttribute('aria-describedby')).toBe(support.id);
        expect(native(host).hasAttribute('aria-invalid')).toBe(false);
    });

    it('respects exact native IDs, label overrides, and authored ARIA tokens', async () => {
        const host = mount(`
            <div x-is="input-field" id="field" label="Email" support="Help"
                native:id="exact" native:aria-describedby="external"
                label:for="override"></div>
        `);
        await tick();
        expect(native(host).id).toBe('exact');
        expect(host.querySelector('[data-isas-input-field-label]').htmlFor).toBe('override');
        expect(native(host).getAttribute('aria-describedby').split(/\s+/))
            .toEqual(['external', 'field-support']);
    });

    it('mirrors an Alpine x-id binding into the label association', async () => {
        const host = mount(`
            <div x-is="input-field" x-id="['account-input']" label="Account"
                native::id="$id('account-input')"></div>
        `);
        await tick();
        const control = native(host);
        expect(control.id).toMatch(/^account-input-/);
        expect(host.querySelector('[data-isas-input-field-label]').htmlFor).toBe(control.id);
    });
});

describe('input-field Alpine scope bridge', () => {
    it('exposes one stable live proxy through both field-level paths', async () => {
        const host = mount(`
            <div x-is="input-field" label="Name" clearable native:value="Before">
                <label x-part="label">
                    <button type="button" @click="$input.clear()">Clear alias</button>
                    <button type="button" @click="$inputField.input.clear()">Clear nested</button>
                    <output x-text="String($input === $inputField.input)"></output>
                </label>
                <div x-part="control"></div>
            </div>
        `);
        await tick();
        const data = Alpine.$data(host);
        const proxy = data.$input;
        expect(proxy).toBe(data.$inputField.input);
        expect(host.querySelector('output').textContent).toBe('true');
        expect(proxy.clear).toBeTypeOf('function');

        const events = [];
        native(host).addEventListener('input', () => events.push('input'));
        host.querySelector('button').click();
        expect(native(host).value).toBe('');
        expect(events).toEqual(['input']);

        native(host).value = 'Again';
        host.querySelectorAll('button')[1].click();
        expect(native(host).value).toBe('');
        expect(data.$input).toBe(proxy);
    });

    it('stages early writes and retargets without replacing the proxy', async () => {
        const host = mount(`
            <div x-is="input-field" label="Name">
                <label x-part="label"></label>
                <div x-part="control">
                    <label x-is="input:query" marker="child"></label>
                </div>
            </div>
        `);
        await tick();
        const proxy = Alpine.$data(host).$input;
        expect(proxy.marker).toBe('child');
        HostRuntime.from(host).component.scopeBridge.disconnect();
        proxy.staged = 'ready';
        expect(proxy.clear()).toBe(false);
        host.setAttribute('data-reconnect', 'true');
        await tick();
        expect(proxy.staged).toBe('ready');

        const inputHost = host.querySelector('[data-isas-input-field-input]');
        const childData = Alpine.$data(inputHost);
        expect(childData.query.staged).toBe('ready');
        expect(childData.$input).toBe(proxy);

        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'input-field');
        incoming.setAttribute('label', 'Updated');
        incoming.innerHTML = `
            <label x-part="label"></label>
            <div x-part="control"><label x-is="input:next" marker="next"></label></div>
        `;
        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();
        expect(Alpine.$data(host).$input).toBe(proxy);
        expect(proxy.marker).toBe('next');

        Alpine.destroyTree(host);
        expect(proxy.clear()).toBe(false);
    });

    it('delegates showError to the nested Input scope', async () => {
        const host = mount(`
            <div x-is="input-field" label="Email" error="Invalid"></div>
        `);
        await tick();
        const control = native(host);
        const focus = vi.spyOn(control, 'focus');
        const report = vi.spyOn(control, 'reportValidity').mockReturnValue(false);
        expect(Alpine.$data(host).$inputField.input.showError()).toBe(false);
        expect(focus).toHaveBeenCalledOnce();
        expect(report).toHaveBeenCalledOnce();
    });
});

function REGION(element) {
    return ['label', 'control', 'support', 'error'].find((name) => (
        element.hasAttribute(`data-isas-input-field-${name}`)
    ));
}
