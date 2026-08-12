import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, {
    HostRuntime,
    Input,
    inputAdapter,
    Isas,
} from '../src/index.js';
import { resolveError } from '../src/components/input/input.js';
import { translateNativeLivewireAliases } from '../src/components/input/native-livewire-alias.js';

const tick = async () => {
    await Promise.resolve();
    await Alpine.nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
};

function mount(html) {
    document.body.innerHTML = html;
    Alpine.initTree(document.body);
    return document.body.firstElementChild;
}

function native(host) {
    return host.querySelector(':scope > input[data-isas-input-native]');
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

describe('input structure and native attributes', () => {
    it('registers the input component and adapter', () => {
        expect(Isas.components.get('input')).toBe(Input);
        expect(Isas.adapters.get('input')).toBe(inputAdapter);
    });

    it('generates a styled native input from explicit native attributes', async () => {
        const host = mount(`
            <label x-is="input" size="sm" color="primary" variant="ghost"
                native:type="email" native:name="email" native:placeholder="Work email"
                native:class="authored-native" class="w-full"></label>
        `);
        await tick();

        const control = native(host);
        expect(host.className).toBe('input group input-sm input-primary input-ghost w-full');
        expect(host.getAttribute('native:type')).toBe('email');
        expect(control.type).toBe('email');
        expect(control.name).toBe('email');
        expect(control.placeholder).toBe('Work email');
        expect(control.className).toBe('grow min-w-0 authored-native');
        expect(control.hasAttribute('x-part')).toBe(false);
    });

    it('keeps the component namespace host-focused instead of proxying native state', async () => {
        const host = mount(`
            <label x-is="input" clearable native:value="Native value" native:name="email"></label>
        `);
        await tick();

        const state = Alpine.$data(host).$input;
        expect(state.el).toBe(host);
        expect(state.clearable).toBe(true);
        expect(state.clear).toBeTypeOf('function');
        expect(state.showError).toBeTypeOf('function');
        expect('value' in state).toBe(false);
        expect('native' in state).toBe(false);
        expect(native(host).value).toBe('Native value');
    });

    it('keeps an authored native input and gives its attributes precedence', async () => {
        const host = mount(`
            <label x-is="input" native:name="root" native:placeholder="Root"
                native:class="root-native" native:lw:model.live="rootValue">
                <input x-part="native" name="authored" placeholder="Authored"
                    class="authored-native" wire:model.live="authoredValue">
            </label>
        `);
        await tick();

        const control = native(host);
        expect(control.getAttribute('x-part')).toBe('native');
        expect(control.name).toBe('authored');
        expect(control.placeholder).toBe('Authored');
        expect(control.className).toBe('grow min-w-0 root-native authored-native');
        expect(control.getAttribute('wire:model.live')).toBe('authoredValue');
        expect(control.hasAttribute('lw:model.live')).toBe(false);
    });

    it('rejects repeated or non-input native parts', () => {
        expect(() => mount(`
            <label x-is="input">
                <input x-part="native">
                <input x-part="native">
            </label>
        `)).toThrow("allows only one x-part='native'");

        document.body.replaceChildren();
        expect(() => mount(`
            <label x-is="input"><textarea x-part="native"></textarea></label>
        `)).toThrow("requires x-part='native' to use an <input>");
    });

    it('preserves an authored native part across source reconciliation', async () => {
        const host = mount(`
            <label x-is="input" native:class="root-one">
                <input x-part="native" wire:key="control" name="before">
            </label>
        `);
        await tick();
        const control = native(host);

        const incoming = document.createElement('label');
        incoming.setAttribute('x-is', 'input');
        incoming.setAttribute('native:class', 'root-two');
        incoming.innerHTML = `
            <input x-part="native" wire:key="control" name="after" placeholder="Updated">
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(native(host)).toBe(control);
        expect(control.name).toBe('after');
        expect(control.placeholder).toBe('Updated');
        expect(control.className).toBe('grow min-w-0 root-two');
    });

    it('restores canonical authored content on teardown', async () => {
        const generated = mount('<label x-is="input" native:name="generated"></label>');
        await tick();
        expect(native(generated)).not.toBeNull();
        Alpine.destroyTree(generated);
        expect(generated.innerHTML).toBe('');

        document.body.replaceChildren();
        const authored = mount(`
            <label x-is="input" native:class="root">
                <input x-part="native" name="authored" class="local">
            </label>
        `);
        await tick();
        Alpine.destroyTree(authored);
        expect(authored.firstElementChild.outerHTML)
            .toBe('<input x-part="native" name="authored" class="local">');
    });
});

describe('input Livewire compatibility alias', () => {
    it('translates only leading lw aliases and lets canonical attributes win', () => {
        const translated = translateNativeLivewireAliases({
            'lw:model.live.debounce.250ms': 'aliasValue',
            'wire:model.live.debounce.250ms': 'canonicalValue',
            'lw:click': 'save',
            'data-lw:model': 'untouched',
        });

        expect(translated.get('wire:model.live.debounce.250ms')).toBe('canonicalValue');
        expect(translated.get('wire:click')).toBe('save');
        expect(translated.get('data-lw:model')).toBe('untouched');
        expect(translated.has('lw:model.live.debounce.250ms')).toBe(false);
        expect(translated.has('lw:click')).toBe(false);
    });

    it('forwards canonical and aliased directives while retaining host source attributes', async () => {
        const host = mount(`
            <label x-is="input"
                native:lw:model.live.debounce.250ms="email"
                native:lw:click="save"
                native:wire:blur="validate"></label>
        `);
        await tick();

        const control = native(host);
        expect(host.getAttribute('native:lw:model.live.debounce.250ms')).toBe('email');
        expect(host.getAttribute('native:lw:click')).toBe('save');
        expect(host.getAttribute('native:wire:blur')).toBe('validate');
        expect(control.getAttribute('wire:model.live.debounce.250ms')).toBe('email');
        expect(control.getAttribute('wire:click')).toBe('save');
        expect(control.getAttribute('wire:blur')).toBe('validate');
        expect(control.getAttributeNames().some((name) => name.startsWith('lw:'))).toBe(false);
    });
});

describe('input accessories and clear behavior', () => {
    it('renders append content before clear and error actions', async () => {
        const host = mount(`
            <label x-is="input" icon="generated-start" icon-end="generated-end"
                clearable error>
                <strong slot="prepend" class="authored-start">Start</strong>
                <strong slot="append" class="authored-end">End</strong>
            </label>
        `);
        await tick();

        expect(host.querySelector('.generated-start')).toBeNull();
        expect(host.querySelector('.generated-end')).toBeNull();
        expect([...host.children].map((child) => (
            child.getAttribute('data-isas-input-action')
            ?? (child.hasAttribute('data-isas-input-native') ? 'native' : child.className)
        ))).toEqual([
            'inline-flex shrink-0 items-center',
            'native',
            'inline-flex shrink-0 items-center',
            'clear',
            'error',
        ]);
        expect(host.children[0].firstElementChild.matches('strong.authored-start')).toBe(true);
        expect(host.children[2].firstElementChild.matches('strong.authored-end')).toBe(true);
    });

    it('shares clear behavior between the namespace helper and delegated action', async () => {
        const host = mount('<label x-is="input" clearable native:value="Before"></label>');
        await tick();
        const control = native(host);
        const clear = Alpine.$data(host).$input.clear;
        const events = [];
        control.addEventListener('input', () => events.push('input'));
        control.addEventListener('change', () => events.push('change'));

        expect(clear()).toBe(true);
        expect(control.value).toBe('');
        expect(events).toEqual(['input', 'change']);

        control.value = 'Again';
        host.querySelector('[data-isas-input-action="clear"]').click();

        expect(control.value).toBe('');
        expect(events).toEqual(['input', 'change', 'input', 'change']);

        control.remove();
        expect(clear()).toBe(false);
    });

    it.each(['disabled', 'readonly'])('disables clearing for a %s native input', async (state) => {
        const host = mount(`
            <label x-is="input" clearable native:value="Before" native:${state}></label>
        `);
        await tick();
        const control = native(host);
        const clear = host.querySelector('[data-isas-input-action="clear"]');
        const clearHelper = Alpine.$data(host).$input.clear;

        expect(clear.disabled).toBe(true);
        expect(clearHelper()).toBe(false);
        clear.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(control.value).toBe('Before');
    });

});

describe('input error state', () => {
    it.each([
        [undefined, false, ''],
        [false, false, ''],
        ['false', false, ''],
        ['0', false, ''],
        ['off', false, ''],
        ['', true, ''],
        ['true', true, ''],
        ['1', true, ''],
        [' Required ', true, 'Required'],
    ])('resolves error value %s', (value, active, message) => {
        const attributes = value === undefined ? {} : { error: value };
        expect(resolveError({
            has: (name) => Object.hasOwn(attributes, name),
            get: (name) => attributes[name],
        })).toEqual({ active, message });
    });

    it('synchronizes owned validity, aria state, focus, and reportValidity', async () => {
        const host = mount(`
            <label x-is="input" error="Use a work email" native:aria-invalid="false"></label>
        `);
        await tick();
        const control = native(host);
        const focus = vi.spyOn(control, 'focus');
        const report = vi.spyOn(control, 'reportValidity').mockReturnValue(false);
        const showError = Alpine.$data(host).$input.showError;

        expect(host.classList.contains('input-error')).toBe(true);
        expect(control.validationMessage).toBe('Use a work email');
        expect(control.getAttribute('aria-invalid')).toBe('true');

        expect(showError()).toBe(false);
        expect(focus).toHaveBeenCalledOnce();
        expect(report).toHaveBeenCalledOnce();

        host.querySelector('[data-isas-input-action="error"]').click();
        expect(focus).toHaveBeenCalledTimes(2);
        expect(report).toHaveBeenCalledTimes(2);

        host.setAttribute('error', '');
        await tick();
        expect(control.validationMessage).toBe('');
        expect(control.getAttribute('aria-invalid')).toBe('true');

        host.removeAttribute('error');
        await tick();
        expect(host.classList.contains('input-error')).toBe(false);
        expect(control.getAttribute('aria-invalid')).toBe('false');
        expect(host.querySelector('[data-isas-input-action="error"]')).toBeNull();

        control.remove();
        expect(showError()).toBe(false);
    });

    it('does not clear a custom validity message that replaced its owned message', async () => {
        const host = mount('<label x-is="input" error="Owned"></label>');
        await tick();
        const control = native(host);
        control.setCustomValidity('External');

        host.removeAttribute('error');
        await tick();

        expect(control.validationMessage).toBe('External');
    });

    it('supports default, prop, and slotted error icons with namespaced attributes', async () => {
        const defaults = mount('<label x-is="input" error></label>');
        await tick();
        expect(defaults.querySelector('.i-tabler-alert-circle')).not.toBeNull();

        Alpine.destroyTree(defaults);
        document.body.replaceChildren();
        const prop = mount(`
            <label x-is="input" error error-icon="i-custom-error"
                error-icon:class="authored-icon" error-icon:title="Problem"></label>
        `);
        await tick();
        const propIcon = prop.querySelector('.i-custom-error');
        expect(propIcon.className).toBe('authored-icon i-custom-error');
        expect(propIcon.title).toBe('Problem');
        expect(prop.querySelector('.i-tabler-alert-circle')).toBeNull();

        Alpine.destroyTree(prop);
        document.body.replaceChildren();
        const slotted = mount(`
            <label x-is="input" error error-icon="ignored-prop"
                error-icon:class="forwarded" error-icon:title="Slotted problem">
                <strong slot="error-icon" class="authored-slot">!</strong>
            </label>
        `);
        await tick();
        const slotIcon = slotted.querySelector('[data-isas-input-action="error"] > strong');
        expect(slotIcon.className).toBe('forwarded authored-slot');
        expect(slotIcon.title).toBe('Slotted problem');
        expect(slotIcon.hasAttribute('slot')).toBe(false);
    });
});
