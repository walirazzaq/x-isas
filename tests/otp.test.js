import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, {
    HostRuntime,
    Isas,
    Otp,
    otpAdapter,
} from '../src/index.js';
import { resolveOtpLength } from '../src/components/otp/otp.js';
import { AttributeBag } from '../src/support/attribute-bag.js';

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
    return host.querySelector(':scope > input[data-isas-otp-native]');
}

function cells(host) {
    return [...host.querySelectorAll(':scope > span')];
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

describe('otp structure and native attributes', () => {
    it('registers the component and DaisyUI adapter', () => {
        expect(Isas.components.get('otp')).toBe(Otp);
        expect(Isas.adapters.get('otp')).toBe(otpAdapter);
    });

    it('resolves the default and supported explicit lengths', () => {
        expect(resolveOtpLength(new AttributeBag())).toBe(6);

        for (let length = 1; length <= 8; length += 1) {
            expect(resolveOtpLength(new AttributeBag({ length }))).toBe(length);
        }

        for (const length of ['', '0', '9', '2.5', '06', 'code']) {
            expect(() => resolveOtpLength(new AttributeBag({ length })))
                .toThrow('length must be an integer from 1 to 8');
        }
    });

    it('requires a label host', () => {
        expect(() => mount('<div x-is="otp"></div>'))
            .toThrow("requires an authored <label> host");
    });

    it('generates a required six-digit numeric control by default', async () => {
        const host = mount(`
            <label x-is="otp" native:name="verification_code"
                native:aria-label="Verification code"></label>
        `);
        await tick();

        const control = native(host);
        expect(host.className).toBe('otp');
        expect([...host.children]).toEqual([...cells(host), control]);
        expect(cells(host)).toHaveLength(6);
        expect(cells(host).every((cell) => (
            cell.getAttribute('aria-hidden') === 'true' && cell.childNodes.length === 0
        ))).toBe(true);
        expect(control.type).toBe('text');
        expect(control.autocomplete).toBe('one-time-code');
        expect(control.inputMode).toBe('numeric');
        expect(control.maxLength).toBe(6);
        expect(control.pattern).toBe('[0-9]{6}');
        expect(control.required).toBe(true);
        expect(control.name).toBe('verification_code');
        expect(control.getAttribute('aria-label')).toBe('Verification code');
    });

    it('supports length, optional mode, and repeated cell attributes', async () => {
        const host = mount(`
            <label x-is="otp" length="4" required="false"
                cell:class="authored-cell" cell:data-kind="digit"></label>
        `);
        await tick();

        expect(cells(host)).toHaveLength(4);
        expect(cells(host).every((cell) => (
            cell.className === 'authored-cell'
            && cell.dataset.kind === 'digit'
            && cell.getAttribute('aria-hidden') === 'true'
        ))).toBe(true);
        expect(native(host).required).toBe(false);
        expect(native(host).maxLength).toBe(4);
        expect(native(host).pattern).toBe('[0-9]{4}');
    });

    it('lets native attributes override generated format defaults', async () => {
        const host = mount(`
            <label x-is="otp" length="8" required="false"
                native:type="password"
                native:autocomplete="off"
                native:inputmode="text"
                native:maxlength="12"
                native:pattern="[A-Z0-9]{8}"
                native:required></label>
        `);
        await tick();

        const control = native(host);
        expect(cells(host)).toHaveLength(8);
        expect(control.type).toBe('password');
        expect(control.autocomplete).toBe('off');
        expect(control.inputMode).toBe('text');
        expect(control.maxLength).toBe(12);
        expect(control.pattern).toBe('[A-Z0-9]{8}');
        expect(control.required).toBe(true);
    });

    it('retains an authored native input and gives authored attributes precedence', async () => {
        const host = mount(`
            <label x-is="otp" length="4" native:name="root"
                native:class="root-native" native:lw:model.live="rootCode">
                <input x-part="native" name="authored" maxlength="5"
                    class="authored-native" wire:model.live="authoredCode">
            </label>
        `);
        await tick();

        const control = native(host);
        expect(cells(host)).toHaveLength(4);
        expect(control.getAttribute('x-part')).toBe('native');
        expect(control.name).toBe('authored');
        expect(control.maxLength).toBe(5);
        expect(control.className).toBe('root-native authored-native');
        expect(control.getAttribute('wire:model.live')).toBe('authoredCode');
        expect(control.hasAttribute('lw:model.live')).toBe(false);
        expect(control.pattern).toBe('[0-9]{4}');
        expect(control.required).toBe(true);
    });

    it('translates native Livewire aliases on generated controls', async () => {
        const host = mount(`
            <label x-is="otp"
                native:lw:model.live.debounce.250ms="code"
                native:wire:blur="validate"></label>
        `);
        await tick();

        const control = native(host);
        expect(host.getAttribute('native:lw:model.live.debounce.250ms')).toBe('code');
        expect(control.getAttribute('wire:model.live.debounce.250ms')).toBe('code');
        expect(control.getAttribute('wire:blur')).toBe('validate');
        expect(control.getAttributeNames().some((name) => name.startsWith('lw:'))).toBe(false);
    });

    it('rejects extra content and invalid native parts', () => {
        expect(() => mount(`
            <label x-is="otp"><strong>Verification code</strong></label>
        `)).toThrow("only accepts an optional x-part='native' child");

        document.body.replaceChildren();
        expect(() => mount(`
            <label x-is="otp">
                <input x-part="native">
                <input x-part="native">
            </label>
        `)).toThrow("allows only one x-part='native'");

        document.body.replaceChildren();
        expect(() => mount(`
            <label x-is="otp"><textarea x-part="native"></textarea></label>
        `)).toThrow("requires x-part='native' to use an <input>");
    });

    it('preserves an authored native part across source reconciliation', async () => {
        const host = mount(`
            <label x-is="otp" length="4" native:class="before">
                <input x-part="native" wire:key="otp-control" name="before">
            </label>
        `);
        await tick();
        const control = native(host);

        const incoming = document.createElement('label');
        incoming.setAttribute('x-is', 'otp');
        incoming.setAttribute('length', '6');
        incoming.setAttribute('native:class', 'after');
        incoming.innerHTML = `
            <input x-part="native" wire:key="otp-control" name="after" value="123456">
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(native(host)).toBe(control);
        expect(cells(host)).toHaveLength(6);
        expect(control.name).toBe('after');
        expect(control.className).toBe('after');
        expect(control.value).toBe('123456');
    });

    it('restores canonical authored content on teardown', async () => {
        const generated = mount('<label x-is="otp"></label>');
        await tick();
        expect(generated.children).toHaveLength(7);
        Alpine.destroyTree(generated);
        expect(generated.innerHTML).toBe('');

        document.body.replaceChildren();
        const authored = mount(`
            <label x-is="otp">
                <input x-part="native" name="authored" class="local">
            </label>
        `);
        await tick();
        Alpine.destroyTree(authored);
        expect(authored.firstElementChild.outerHTML)
            .toBe('<input x-part="native" name="authored" class="local">');
    });
});

describe('otp presentation and invalid state', () => {
    it('maps sizes, colors, and joined presentation', async () => {
        const host = mount(`
            <label x-is="otp" size="lg" color="primary" joined class="authored"></label>
        `);
        await tick();

        expect(host.className).toBe('otp otp-lg otp-primary otp-joined authored');
    });

    it('lets invalid override color and manages native aria-invalid', async () => {
        const host = mount('<label x-is="otp" color="success" invalid></label>');
        await tick();

        const control = native(host);
        expect(host.className).toBe('otp otp-error');
        expect(control.getAttribute('aria-invalid')).toBe('true');
        expect(control.validationMessage).toBe('');

        host.removeAttribute('invalid');
        await tick();
        expect(host.className).toBe('otp otp-success');
        expect(control.hasAttribute('aria-invalid')).toBe(false);

        host.setAttribute('invalid', '');
        await tick();
        expect(host.className).toBe('otp otp-error');
        expect(control.getAttribute('aria-invalid')).toBe('true');
    });

    it('lets an explicit native aria state override invalid defaults', async () => {
        const host = mount(`
            <label x-is="otp" invalid native:aria-invalid="false"></label>
        `);
        await tick();

        expect(host.className).toBe('otp otp-error');
        expect(native(host).getAttribute('aria-invalid')).toBe('false');
    });

    it('reacts to managed length and required changes without stale output', async () => {
        const host = mount('<label x-is="otp" length="4"></label>');
        await tick();

        host.setAttribute('length', '8');
        host.setAttribute('required', 'false');
        await tick();

        expect(cells(host)).toHaveLength(8);
        let current = native(host);
        expect(current.maxLength).toBe(8);
        expect(current.pattern).toBe('[0-9]{8}');
        expect(current.required).toBe(false);

        host.removeAttribute('required');
        await tick();
        current = native(host);
        expect(current.required).toBe(true);
    });
});

describe('otp completion and submission', () => {
    it('emits a bubbling, composed, cancelable complete event', async () => {
        const form = mount(`
            <form>
                <label x-is="otp" length="4"></label>
            </form>
        `);
        await tick();
        const host = form.querySelector('[x-is="otp"]');
        const control = native(host);
        const complete = vi.fn();
        form.addEventListener('complete', complete);

        control.value = '123';
        control.dispatchEvent(new Event('input', { bubbles: true }));
        expect(complete).not.toHaveBeenCalled();

        control.value = '1234';
        control.dispatchEvent(new Event('input', { bubbles: true }));

        expect(complete).toHaveBeenCalledOnce();
        const event = complete.mock.calls[0][0];
        expect(event.target).toBe(host);
        expect(event.bubbles).toBe(true);
        expect(event.composed).toBe(true);
        expect(event.cancelable).toBe(true);
        expect(event.detail).toEqual({ value: '1234', length: 4 });
    });

    it('does not complete when the native value violates its constraints', async () => {
        const host = mount('<label x-is="otp" length="4"></label>');
        await tick();
        const control = native(host);
        const complete = vi.fn();
        host.addEventListener('complete', complete);

        control.value = 'ABCD';
        control.dispatchEvent(new Event('input', { bubbles: true }));
        expect(control.validity.valid).toBe(false);
        expect(complete).not.toHaveBeenCalled();

        host.setAttribute('native:inputmode', 'text');
        host.setAttribute('native:pattern', '[A-Z]{4}');
        await tick();
        control.value = 'ABCD';
        control.dispatchEvent(new Event('input', { bubbles: true }));
        expect(complete).toHaveBeenCalledOnce();
    });

    it('auto-submits the nearest form after an accepted complete event', async () => {
        const form = mount(`
            <form>
                <label x-is="otp" length="4" auto-submit></label>
            </form>
        `);
        await tick();
        const host = form.querySelector('[x-is="otp"]');
        const control = native(host);
        const submit = vi.spyOn(form, 'requestSubmit').mockImplementation(() => {});
        const complete = vi.fn();
        form.addEventListener('complete', complete);

        control.value = '1234';
        control.dispatchEvent(new Event('input', { bubbles: true }));

        expect(complete).toHaveBeenCalledOnce();
        expect(submit).toHaveBeenCalledOnce();
    });

    it('lets cancellation suppress auto-submit', async () => {
        const form = mount(`
            <form>
                <label x-is="otp" length="4" auto-submit></label>
            </form>
        `);
        await tick();
        const host = form.querySelector('[x-is="otp"]');
        const control = native(host);
        const submit = vi.spyOn(form, 'requestSubmit').mockImplementation(() => {});
        host.addEventListener('complete', (event) => event.preventDefault());

        control.value = '1234';
        control.dispatchEvent(new Event('input', { bubbles: true }));

        expect(submit).not.toHaveBeenCalled();
    });

    it('still emits without auto-submit or an ancestor form', async () => {
        const host = mount('<label x-is="otp" length="4"></label>');
        await tick();
        const control = native(host);
        const complete = vi.fn();
        host.addEventListener('complete', complete);

        control.value = '1234';
        control.dispatchEvent(new Event('input', { bubbles: true }));

        expect(complete).toHaveBeenCalledOnce();
    });

    it('emits again when a complete backend-invalid value is corrected', async () => {
        const host = mount('<label x-is="otp" length="4" invalid></label>');
        await tick();
        const control = native(host);
        const values = [];
        host.addEventListener('complete', (event) => values.push(event.detail.value));

        control.value = '1111';
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.value = '2222';
        control.dispatchEvent(new Event('input', { bubbles: true }));

        expect(values).toEqual(['1111', '2222']);
    });

    it('does not complete or submit merely from mounting or source reconciliation', async () => {
        const form = mount(`
            <form>
                <label x-is="otp" length="4" auto-submit native:value="1234"></label>
            </form>
        `);
        const host = form.querySelector('[x-is="otp"]');
        const submit = vi.spyOn(form, 'requestSubmit').mockImplementation(() => {});
        const complete = vi.fn();
        form.addEventListener('complete', complete);
        await tick();

        expect(complete).not.toHaveBeenCalled();
        expect(submit).not.toHaveBeenCalled();

        const incoming = document.createElement('label');
        incoming.setAttribute('x-is', 'otp');
        incoming.setAttribute('length', '4');
        incoming.setAttribute('auto-submit', '');
        incoming.setAttribute('native:value', '5678');

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();
        expect(complete).not.toHaveBeenCalled();
        expect(submit).not.toHaveBeenCalled();
    });
});
