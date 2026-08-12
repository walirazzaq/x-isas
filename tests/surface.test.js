import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, {
    Dialog,
    DialogTrigger,
    dialogAdapter,
    Dropdown,
    DropdownTrigger,
    dropdownAdapter,
    HostRuntime,
    Isas,
    Overlay,
    OverlayTrigger,
    overlayAdapter,
} from '../src/index.js';

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

describe('attribute-linked surfaces', () => {
    it('registers targets, functional triggers, and default adapters', () => {
        expect(Isas.components.get('dropdown')).toBe(Dropdown);
        expect(Isas.components.get('dropdown-trigger')).toBe(DropdownTrigger);
        expect(Isas.components.get('dialog')).toBe(Dialog);
        expect(Isas.components.get('dialog-trigger')).toBe(DialogTrigger);
        expect(Isas.components.get('overlay')).toBe(Overlay);
        expect(Isas.components.get('overlay-trigger')).toBe(OverlayTrigger);
        expect(Isas.adapters.get('dropdown')).toBe(dropdownAdapter);
        expect(Isas.adapters.get('dialog')).toBe(dialogAdapter);
        expect(Isas.adapters.get('overlay')).toBe(overlayAdapter);
    });

    it('links an x-isas dropdown trigger to an authored popover target', async () => {
        const trigger = mount(`
            <button x-is="button" type="button" controls-dropdown="account-menu">Open</button>
            <div x-is="dropdown" id="account-menu" placement="top-end">
                <input value="retained">
            </div>
        `);
        await tick();

        const target = document.getElementById('account-menu');
        const input = target.querySelector('input');
        const triggerScope = Alpine.$data(trigger).$dropdown;
        const targetScope = Alpine.$data(target).$dropdown;

        expect(triggerScope.linked).toBe(true);
        expect(triggerScope.target).toBe(target);
        expect(targetScope.linked).toBe(true);
        expect(target.getAttribute('popover')).toBe('auto');
        expect(target.classList).toContain('dropdown');
        expect(target.classList).toContain('dropdown-top');
        expect(target.classList).toContain('dropdown-end');
        expect(trigger.getAttribute('aria-controls')).toBe('account-menu');

        expect(triggerScope.show()).toBe(true);
        await tick();
        expect(triggerScope.open).toBe(true);
        expect(targetScope.open).toBe(true);
        expect(target.classList).toContain('dropdown-open');
        expect(target.querySelector('input')).toBe(input);

        expect(targetScope.hide()).toBe(true);
        await tick();
        expect(triggerScope.open).toBe(false);
        expect(target.classList).not.toContain('dropdown-open');
        expect(target.querySelector('input')).toBe(input);
    });

    it('lets a nested menu own item parts inside a dropdown target', async () => {
        const trigger = mount(`
            <button x-is="button" type="button" controls-dropdown="actions-menu">Open</button>
            <div x-is="dropdown" id="actions-menu">
                <ul x-is="menu">
                    <li x-part="item" label="Rename"></li>
                    <li x-part="item" @click="$dropdown.hide()">Close</li>
                </ul>
            </div>
        `);
        await tick();

        const target = document.getElementById('actions-menu');
        const menu = target.querySelector(':scope > [x-is="menu"]');
        const close = menu.querySelectorAll(':scope > [x-part="item"]')[1];

        expect(HostRuntime.from(target).component.name).toBe('dropdown');
        expect(HostRuntime.from(menu).component.name).toBe('menu');
        expect(menu.classList).toContain('menu');
        expect(menu.querySelectorAll(':scope > [x-part="item"]')).toHaveLength(2);
        expect(menu.querySelector('[x-part="item"] button').textContent).toBe('Rename');

        expect(Alpine.$data(trigger).$dropdown.show()).toBe(true);
        await tick();
        close.click();
        await tick();
        expect(Alpine.$data(trigger).$dropdown.open).toBe(false);
    });

    it('supports target-before-trigger, late targets, and target replacement', async () => {
        const target = mount(`
            <div x-is="dropdown" id="late-menu"><p>First</p></div>
            <button x-is="button" type="button" controls-dropdown="late-menu">Open</button>
        `);
        await tick();
        const trigger = target.nextElementSibling;
        expect(Alpine.$data(trigger).$dropdown.target).toBe(target);

        Alpine.destroyTree(target);
        target.remove();
        await tick();
        expect(Alpine.$data(trigger).$dropdown.linked).toBe(false);

        const replacement = document.createElement('div');
        replacement.id = 'late-menu';
        replacement.setAttribute('x-is', 'dropdown');
        replacement.innerHTML = '<p>Replacement</p>';
        document.body.append(replacement);
        Alpine.initTree(replacement);
        await tick();
        expect(Alpine.$data(trigger).$dropdown.target).toBe(replacement);
    });

    it('supports multiple triggers and matching explicit namespaces', async () => {
        const first = mount(`
            <button x-is="button" controls-dialog="shared-dialog">First</button>
            <button controls-dialog="shared-dialog"
                x-as="dialog-trigger:$loginDialog">Second</button>
            <dialog x-is="dialog:$loginDialog" id="shared-dialog"
                aria-label="Shared dialog">
                <section x-part="content">Body</section>
            </dialog>
        `);
        await tick();

        const second = first.nextElementSibling;
        const target = second.nextElementSibling;
        expect(Alpine.$data(first).$dialog.target).toBe(target);
        expect(Alpine.$data(second).$loginDialog.target).toBe(target);
        expect(Alpine.$data(target).$loginDialog.linked).toBe(true);

        expect(Alpine.$data(second).$loginDialog.show()).toBe(true);
        expect(Alpine.$data(target).$loginDialog.activeTrigger).toBe(second);
        expect(Alpine.$data(first).$dialog.open).toBe(true);
        expect(Alpine.$data(first).$dialog.close('done')).toBe(true);
        expect(Alpine.$data(target).$loginDialog.returnValue).toBe('done');
    });

    it('maps an authored dialog and content part to DaisyUI without moving content', async () => {
        const trigger = mount(`
            <button x-is="button" controls-dialog="settings">Settings</button>
            <dialog x-is="dialog" id="settings" aria-labelledby="settings-title"
                class="authored-dialog" closedby="any">
                <form x-part="content" class="authored-box">
                    <h2 id="settings-title">Settings</h2>
                    <footer class="modal-action">Actions</footer>
                </form>
            </dialog>
        `);
        await tick();

        const dialog = document.getElementById('settings');
        const content = dialog.querySelector('[x-part="content"]');
        const scope = Alpine.$data(dialog).$dialog;
        expect(dialog.classList).toContain('modal');
        expect(dialog.classList).toContain('modal-middle');
        expect(dialog.classList).toContain('authored-dialog');
        expect(content.classList).toContain('modal-box');
        expect(content.classList).toContain('authored-box');
        expect(scope.closedBy).toBe('any');
        expect(scope.presentation).toBe('dialog');

        scope.closedBy = 'none';
        await tick();
        expect(dialog.getAttribute('closedby')).toBe('none');
        expect(Alpine.$data(trigger).$dialog.closedBy).toBe('none');
    });

    it('provides the same visibility API on target and trigger scopes', async () => {
        const trigger = mount(`
            <button x-is="button" controls-dialog="api-dialog">Open</button>
            <dialog x-is="dialog" id="api-dialog" aria-label="API dialog">
                <section x-part="content">Body</section>
            </dialog>
        `);
        await tick();

        const target = document.getElementById('api-dialog');
        const triggerScope = Alpine.$data(trigger).$dialog;
        const targetScope = Alpine.$data(target).$dialog;
        for (const scope of [triggerScope, targetScope]) {
            for (const method of ['show', 'hide', 'close', 'toggle', 'requestClose']) {
                expect(typeof scope[method]).toBe('function');
            }
            expect(scope.presentation).toBe('dialog');
        }

        expect(triggerScope.show()).toBe(true);
        expect(targetScope.open).toBe(true);
        expect(targetScope.hide()).toBe(true);
        expect(triggerScope.open).toBe(false);
        expect(targetScope.toggle()).toBe(true);
        expect(triggerScope.close('saved')).toBe(true);
        expect(targetScope.returnValue).toBe('saved');
    });

    it('honors cancel prevention in the requestClose compatibility path', async () => {
        const trigger = mount(`
            <button x-is="button" controls-dialog="protected">Open</button>
            <dialog x-is="dialog" id="protected" aria-label="Protected dialog">
                <section x-part="content">Body</section>
            </dialog>
        `);
        await tick();

        const dialog = document.getElementById('protected');
        const scope = Alpine.$data(trigger).$dialog;
        expect(scope.show()).toBe(true);
        dialog.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
        expect(scope.requestClose()).toBe(false);
        expect(scope.open).toBe(true);
    });

    it('applies fallback closedby policies without history integration', async () => {
        const historyLength = history.length;
        const root = mount(`
            <div>
                <button x-is="button" controls-dialog="close-request-dialog">Request</button>
                <dialog x-is="dialog" id="close-request-dialog"
                    closedby="closerequest" aria-label="Close request">
                    <section x-part="content">Body</section>
                </dialog>
                <button x-is="button" controls-dialog="any-dialog">Any</button>
                <dialog x-is="dialog" id="any-dialog"
                    closedby="any" aria-label="Any">
                    <section x-part="content">Body</section>
                </dialog>
                <button x-is="button" controls-dialog="none-dialog">None</button>
                <dialog x-is="dialog" id="none-dialog"
                    closedby="none" aria-label="None">
                    <section x-part="content">Body</section>
                </dialog>
            </div>
        `);
        await tick();

        const request = document.getElementById('close-request-dialog');
        const any = document.getElementById('any-dialog');
        const none = document.getElementById('none-dialog');

        expect(Alpine.$data(request).$dialog.show()).toBe(true);
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        }));
        expect(Alpine.$data(request).$dialog.open).toBe(false);

        expect(Alpine.$data(any).$dialog.show()).toBe(true);
        any.dispatchEvent(new Event('pointerup', { bubbles: true }));
        expect(Alpine.$data(any).$dialog.open).toBe(false);

        expect(Alpine.$data(none).$dialog.show()).toBe(true);
        const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);
        expect(Alpine.$data(none).$dialog.open).toBe(true);
        expect(history.length).toBe(historyLength);
        Alpine.$data(none).$dialog.hide();
        expect(root.isConnected).toBe(true);
    });

    it('changes a non-dialog overlay presentation without replacing descendants', async () => {
        const trigger = mount(`
            <button x-is="button" controls-overlay="filters">Filters</button>
            <div x-is="overlay" id="filters" mode="dialog" aria-labelledby="filters-title">
                <section x-part="content">
                    <h2 id="filters-title">Filters</h2>
                    <input value="initial">
                </section>
            </div>
        `);
        await tick();

        const overlay = document.getElementById('filters');
        const content = overlay.querySelector('[x-part="content"]');
        const input = content.querySelector('input');
        const scope = Alpine.$data(trigger).$overlay;
        let presentations = 0;
        overlay.addEventListener('presentationchange', () => { presentations += 1; });

        expect(scope.show()).toBe(true);
        input.value = 'edited';
        scope.mode = 'dropdown';
        await tick();
        await tick();

        expect(scope.open).toBe(true);
        expect(scope.presentation).toBe('dropdown');
        expect(overlay.querySelector('[x-part="content"]')).toBe(content);
        expect(content.querySelector('input')).toBe(input);
        expect(input.value).toBe('edited');
        expect(content.classList).not.toContain('modal-box');
        expect(overlay.classList).toContain('dropdown');
        expect(overlay.classList).not.toContain('modal');
        expect(presentations).toBe(1);
    });

    it('switches one authored dialog overlay between native presentations', async () => {
        const trigger = mount(`
            <button x-is="button" controls-overlay="native-overlay">Open</button>
            <dialog x-is="overlay" id="native-overlay" mode="dialog"
                aria-label="Native overlay">
                <section x-part="content"><input value="retained"></section>
            </dialog>
        `);
        await tick();

        const overlay = document.getElementById('native-overlay');
        const input = overlay.querySelector('input');
        const scope = Alpine.$data(trigger).$overlay;
        expect(scope.show()).toBe(true);
        expect(overlay.open).toBe(true);

        scope.mode = 'dropdown';
        await tick();
        await tick();
        expect(scope.open).toBe(true);
        expect(scope.presentation).toBe('dropdown');
        expect(overlay.open).toBe(false);
        expect(overlay.querySelector('input')).toBe(input);
    });

    it('relinks when a bound controls attribute changes', async () => {
        const root = mount(`
            <div x-data="{ targetId: 'one' }">
                <button x-is="button" :controls-dropdown="targetId">Open</button>
                <div x-is="dropdown" id="one">One</div>
                <div x-is="dropdown" id="two">Two</div>
            </div>
        `);
        await tick();

        const trigger = root.querySelector('button');
        expect(Alpine.$data(trigger).$dropdown.target.id).toBe('one');
        Alpine.$data(root).targetId = 'two';
        await tick();
        await tick();
        expect(Alpine.$data(trigger).$dropdown.target.id).toBe('two');
    });

    it('rejects invalid target definitions and content ownership', async () => {
        expect(() => mount('<div x-is="dropdown"></div>'))
            .toThrow("Component 'dropdown' requires a non-empty id.");

        expect(() => mount(`
            <div>
                <div x-is="dropdown" id="duplicate"></div>
                <div x-is="dropdown" id="duplicate"></div>
            </div>
        `)).toThrow("target id 'duplicate' is already registered");

        expect(() => mount(`
            <div x-is="dialog" id="wrong-host">
                <section x-part="content"></section>
            </div>
        `)).toThrow("requires an authored <dialog> host");

        expect(() => mount(`
            <dialog x-is="dialog" id="missing-content"></dialog>
        `)).toThrow("requires exactly one x-part='content'");

        expect(() => mount(`
            <div x-is="overlay" id="mixed-content">
                <section x-part="content"></section>
                <p>Sibling</p>
            </div>
        `)).toThrow('content part must be its only visible direct child');

        await tick();
    });

    it('keeps normal Livewire-style reconciliation on the target content', async () => {
        const target = mount(`
            <dialog x-is="dialog" id="morph-dialog" aria-label="Morph dialog">
                <section x-part="content"><input value="before"></section>
            </dialog>
        `);
        await tick();

        const input = target.querySelector('input');
        const incoming = document.createElement('dialog');
        incoming.setAttribute('x-is', 'dialog');
        incoming.id = 'morph-dialog';
        incoming.setAttribute('aria-label', 'Morph dialog');
        incoming.innerHTML = `
            <section x-part="content"><input value="after"><p>Added</p></section>
        `;
        Alpine.morph(target, incoming.outerHTML);
        await tick();

        expect(target.querySelector('input')).toBe(input);
        expect(target.querySelector('input').value).toBe('after');
        expect(target.textContent).toContain('Added');
    });

    it('allows a replacement adapter without changing target behavior', async () => {
        const original = Isas.adapters.get('dropdown');
        Isas.adapters.register('dropdown', () => ({
            host: { class: 'replacement-target' },
        }), { replace: true });

        try {
            const trigger = mount(`
                <button x-is="button" controls-dropdown="custom-menu">Open</button>
                <div x-is="dropdown" id="custom-menu">Content</div>
            `);
            await tick();
            const target = document.getElementById('custom-menu');
            expect(target.classList).toContain('replacement-target');
            expect(target.classList).not.toContain('dropdown');
            expect(Alpine.$data(trigger).$dropdown.show()).toBe(true);
        } finally {
            Isas.adapters.register('dropdown', original, { replace: true });
        }
    });

    it('does not activate controls attributes without x-is or x-as', async () => {
        const trigger = mount('<button controls-dropdown="missing">Open</button>');
        await tick();
        expect(HostRuntime.from(trigger)).toBeNull();
        expect(Alpine.$data(trigger).$dropdown).toBeUndefined();
    });

    it('uses the target namespace for an explicit trigger attachment', async () => {
        const trigger = mount(`
            <button x-as="dialog-trigger" controls-dialog="explicit-dialog">Open</button>
            <dialog x-is="dialog" id="explicit-dialog" aria-label="Explicit dialog">
                <section x-part="content">Body</section>
            </dialog>
        `);
        await tick();
        expect(Alpine.$data(trigger).$dialog.linked).toBe(true);
        expect(Alpine.$data(trigger).$dialog.show()).toBe(true);
    });

    it('warns only when an unresolved x-isas trigger is activated', async () => {
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const trigger = mount(
            '<button x-is="button" controls-dropdown="missing">Open</button>',
        );
        await tick();
        expect(warning).not.toHaveBeenCalled();
        trigger.click();
        expect(warning).toHaveBeenCalledOnce();
        trigger.click();
        expect(warning).toHaveBeenCalledOnce();
    });
});
