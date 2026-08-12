import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

const floating = vi.hoisted(() => ({
    autoUpdate: vi.fn((reference, floatingElement, update) => {
        update();
        return vi.fn();
    }),
    computePosition: vi.fn(() => Promise.resolve({
        x: 20,
        y: 30,
        placement: 'top',
        middlewareData: { arrow: { x: 8 } },
    })),
}));

vi.mock('@floating-ui/dom', () => ({
    arrow: (options) => ({ name: 'arrow', options }),
    autoUpdate: floating.autoUpdate,
    computePosition: floating.computePosition,
    flip: (options) => ({ name: 'flip', options }),
    offset: (options) => ({ name: 'offset', options }),
}));

import isas, {
    Component,
    HostRuntime,
    Isas,
    Tooltip,
    tooltipAdapter,
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

function overlay() {
    return document.body.querySelector('[data-isas-tooltip-overlay]');
}

beforeAll(() => {
    globalThis.Alpine = Alpine;
    Alpine.plugin(morph);
    Alpine.plugin(isas);
});

afterEach(async () => {
    Alpine.destroyTree(document.body);
    document.body.replaceChildren();
    floating.autoUpdate.mockClear();
    floating.computePosition.mockReset();
    floating.computePosition.mockResolvedValue({
        x: 20,
        y: 30,
        placement: 'top',
        middlewareData: { arrow: { x: 8 } },
    });
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('attribute-driven Tooltip', () => {
    it('registers Tooltip as an implicitly activated attachment with a primary overlay', async () => {
        expect(Isas.components.get('tooltip')).toBe(Tooltip);
        expect(Isas.adapters.get('tooltip')).toBe(tooltipAdapter);

        const host = mount(`
            <button x-is="button" tooltip="Save &lt;draft&gt;" tooltip:color="primary"
                tooltip:class="authored-overlay" tooltip:content:class="authored-content"
                tooltip:placement="right" tooltip:align="end">
                Save
            </button>
        `);
        await tick();

        const tooltip = overlay();
        const runtime = HostRuntime.from(host);
        const tooltipRuntime = HostRuntime.from(tooltip);

        expect(runtime.componentFor('tooltip')).toBeInstanceOf(Tooltip);
        expect(tooltip.parentElement).toBe(document.body);
        expect(tooltipRuntime.component).toBeInstanceOf(Tooltip);
        expect(tooltipRuntime.component.mode).toBe('primary');
        expect(host.contains(tooltip)).toBe(false);
        expect(host.querySelector('[data-isas-tooltip-overlay]')).toBeNull();
        expect(tooltip.classList.contains('tooltip')).toBe(true);
        expect(tooltip.classList.contains('tooltip-primary')).toBe(true);
        expect(tooltip.classList.contains('tooltip-right')).toBe(true);
        expect(tooltip.classList.contains('tooltip-end')).toBe(true);
        expect(tooltip.classList.contains('tooltip-open')).toBe(false);
        expect(tooltip.classList.contains('authored-overlay')).toBe(true);
        expect(tooltip.querySelector('[data-isas-tooltip-content]').textContent)
            .toBe('Save <draft>');
        expect(tooltip.querySelector('[data-isas-tooltip-content]').classList)
            .toContain('authored-content');
        expect(tooltip.querySelector('[data-isas-floating-arrow]')).toBeNull();
        expect(host.getAttribute('aria-describedby').split(/\s+/)).toContain(tooltip.id);
    });

    it('uses a non-empty rich template before escaped attribute text', async () => {
        mount(`
            <button x-is="button" tooltip="Fallback">
                Help
                <template slot="tooltip">
                    <strong>Keyboard shortcut:</strong> Ctrl+S
                </template>
            </button>
        `);
        await tick();

        const content = overlay().querySelector('[data-isas-tooltip-content]');
        expect(content.querySelector('strong').textContent).toBe('Keyboard shortcut:');
        expect(content.textContent).toContain('Ctrl+S');
        expect(content.textContent).not.toContain('Fallback');
    });

    it('keeps rich content in the trigger Alpine scope across the body portal', async () => {
        const root = mount(`
            <div x-data="{ message: 'Initial scope' }">
                <button x-is="button" tooltip>
                    Help
                    <template slot="tooltip">
                        <span x-text="message"></span>
                    </template>
                </button>
            </div>
        `);
        await tick();

        expect(overlay().querySelector('[x-text]').textContent).toBe('Initial scope');

        Alpine.$data(root).message = 'Updated scope';
        await tick();

        expect(overlay().querySelector('[x-text]').textContent).toBe('Updated scope');
    });

    it('supports explicit x-as on an attachment-only host without bare-attribute activation', async () => {
        const host = mount('<span x-as="tooltip" tooltip="Explicit">Trigger</span>');
        await tick();

        expect(HostRuntime.from(host).component).toBeNull();
        expect(HostRuntime.from(host).componentFor('tooltip')).toBeInstanceOf(Tooltip);
        expect(overlay().textContent).toContain('Explicit');
    });

    it('reconciles dynamic activation without remounting unrelated explicit attachments', async () => {
        let mounts = 0;
        let destroys = 0;

        class StableAttachment extends Component {
            static attachable = true;
            mount() { mounts += 1; }
            destroy() { destroys += 1; }
        }

        Isas.components.register('test-tooltip-stable', StableAttachment);
        const host = mount(`
            <button x-is="button" x-as="test-tooltip-stable">Dynamic</button>
        `);
        await tick();
        const stable = HostRuntime.from(host).componentFor('test-tooltip-stable');

        expect(mounts).toBe(1);
        expect(overlay()).toBeNull();

        host.setAttribute('tooltip', 'Added');
        await tick();
        expect(overlay()).not.toBeNull();
        expect(HostRuntime.from(host).componentFor('test-tooltip-stable')).toBe(stable);
        expect(mounts).toBe(1);
        expect(destroys).toBe(0);

        host.removeAttribute('tooltip');
        await tick();
        expect(overlay()).toBeNull();
        expect(HostRuntime.from(host).componentFor('test-tooltip-stable')).toBe(stable);
        expect(mounts).toBe(1);
        expect(destroys).toBe(0);
    });

    it('keeps activation for a bound tooltip while updating and suppressing empty content', async () => {
        const root = mount(`
            <div x-data="{ tip: 'Initial' }">
                <button x-is="button" :tooltip="tip">Bound</button>
            </div>
        `);
        await tick();

        const host = root.querySelector('button');
        const attachment = HostRuntime.from(host).componentFor('tooltip');
        expect(overlay().textContent).toContain('Initial');

        Alpine.$data(root).tip = '';
        await tick();
        expect(HostRuntime.from(host).componentFor('tooltip')).toBe(attachment);
        expect(host.hasAttribute('aria-describedby')).toBe(false);

        Alpine.$data(root).tip = 'Updated';
        await tick();
        expect(overlay().textContent).toContain('Updated');
        expect(host.getAttribute('aria-describedby')).toContain(overlay().id);
    });

    it('reconciles activation introduced and removed by adopted server source', async () => {
        const host = mount('<button x-is="button">Server source</button>');
        await tick();

        const added = document.createElement('button');
        added.setAttribute('x-is', 'button');
        added.setAttribute('tooltip', 'Introduced');
        added.textContent = 'Server source';
        expect(HostRuntime.from(host).adoptSource(added)).toBe(true);
        await tick();
        expect(HostRuntime.from(host).componentFor('tooltip')).toBeInstanceOf(Tooltip);
        expect(overlay().textContent).toContain('Introduced');

        const removed = document.createElement('button');
        removed.setAttribute('x-is', 'button');
        removed.textContent = 'Server source';
        expect(HostRuntime.from(host).adoptSource(removed)).toBe(true);
        await tick();
        expect(HostRuntime.from(host).componentFor('tooltip')).toBeNull();
        expect(overlay()).toBeNull();
    });

    it('prefers tooltip:placement while retaining tooltip:position as an alias', async () => {
        const host = mount(`
            <button x-is="button" tooltip="Alias" tooltip:placement="right"
                tooltip:position="left" tooltip:align="end">Trigger</button>
        `);
        await tick();

        const data = Alpine.$data(host);
        expect(data.$tooltip.preferredPlacement).toBe('right-end');
        expect(data.$tooltip.placement).toBe('right-end');
        expect(data.$tooltip.side).toBe('right');
        expect(data.$tooltip.align).toBe('end');
        expect(data.$tooltip.isFlipped).toBe(false);
        expect(overlay().classList).toContain('tooltip-right');
        expect(overlay().classList).toContain('tooltip-end');

        host.removeAttribute('tooltip:placement');
        await tick();

        expect(data.$tooltip.preferredPlacement).toBe('left-end');
        expect(overlay().classList).toContain('tooltip-left');
        expect(overlay().classList).not.toContain('tooltip-right');
    });

    it('mirrors trigger geometry and resolves a full-side fallback without shifting', async () => {
        floating.computePosition.mockResolvedValue({
            x: 42,
            y: 64,
            placement: 'bottom-start',
            middlewareData: {},
        });
        const host = mount(`
            <button x-is="button" tooltip="Flips" tooltip:placement="top"
                tooltip:align="start">Trigger</button>
        `);
        vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
            x: 120,
            y: 80,
            left: 120,
            top: 80,
            right: 300,
            bottom: 124,
            width: 180,
            height: 44,
            toJSON: () => ({}),
        });
        await tick();

        host.dispatchEvent(new Event('pointerenter'));
        await tick();

        const tooltip = overlay();
        const data = Alpine.$data(host);
        const surface = tooltip.querySelector('[data-isas-tooltip-content]');
        const options = floating.computePosition.mock.calls[0][2];

        expect(data.$tooltip.open).toBe(true);
        expect(data.$tooltip.preferredPlacement).toBe('top-start');
        expect(data.$tooltip.placement).toBe('bottom-start');
        expect(data.$tooltip.side).toBe('bottom');
        expect(data.$tooltip.align).toBe('start');
        expect(data.$tooltip.isFlipped).toBe(true);
        expect(floating.computePosition.mock.calls[0].slice(0, 2)).toEqual([host, surface]);
        expect(floating.autoUpdate.mock.calls[0].slice(0, 2)).toEqual([host, surface]);
        expect(options.placement).toBe('top-start');
        expect(options.strategy).toBe('fixed');
        expect(options.middleware.map(({ name }) => name))
            .toEqual(['offset', 'flip']);
        expect(options.middleware[1].options).toEqual({
            fallbackPlacements: ['bottom-start', 'right-start', 'left-start'],
            fallbackStrategy: 'bestFit',
            flipAlignment: false,
        });
        expect(tooltip.getAttribute('preferred-placement')).toBe('top-start');
        expect(tooltip.getAttribute('data-placement')).toBe('bottom-start');
        expect(tooltip.hasAttribute('data-flipped')).toBe(true);
        expect(tooltip.style.left).toBe('120px');
        expect(tooltip.style.top).toBe('80px');
        expect(tooltip.style.width).toBe('180px');
        expect(tooltip.style.height).toBe('44px');
        expect(tooltip.style.visibility).toBe('visible');
        expect(surface.style.width).toBe('');
        expect(surface.style.height).toBe('');
        expect(tooltip.classList).toContain('tooltip-bottom');
        expect(tooltip.classList).not.toContain('tooltip-top');
        expect(tooltip.classList).toContain('tooltip-start');
        expect(tooltip.classList).toContain('tooltip-open');
    });

    it('resynchronizes the proxy rectangle through autoUpdate without using returned coordinates', async () => {
        const host = mount('<button x-is="button" tooltip="Moving">Trigger</button>');
        let rect = {
            left: 10,
            top: 20,
            width: 90,
            height: 30,
        };
        vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => ({
            ...rect,
            x: rect.left,
            y: rect.top,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            toJSON: () => ({}),
        }));
        await tick();

        Alpine.$data(host).$tooltip.open = true;
        await tick();
        expect(overlay().style.left).toBe('10px');
        expect(overlay().style.top).toBe('20px');

        rect = {
            left: 48,
            top: 76,
            width: 160,
            height: 52,
        };
        await floating.autoUpdate.mock.calls[0][2]();
        await tick();

        expect(overlay().style.left).toBe('48px');
        expect(overlay().style.top).toBe('76px');
        expect(overlay().style.width).toBe('160px');
        expect(overlay().style.height).toBe('52px');
    });

    it('activates arrow middleware only for a adapter-rendered floating arrow', async () => {
        const arrowAdapter = {
            attributes: ({ attrs }) => ({
                host: { class: ['replacement-tooltip', attrs.has('open') ? 'is-open' : ''] },
                parts: {
                    content: { class: 'replacement-content' },
                },
            }),
            render: ({ renderDefault }) => renderDefault().replace(
                /<\/div>\s*$/,
                '<span data-isas-floating-arrow aria-hidden="true"></span></div>',
            ),
        };
        Isas.adapters.register('tooltip', arrowAdapter, { replace: true });
        floating.computePosition.mockResolvedValue({
            x: 400,
            y: 500,
            placement: 'right',
            middlewareData: { arrow: { y: 13 } },
        });

        try {
            const host = mount('<button x-is="button" tooltip="Arrow">Trigger</button>');
            await tick();
            Alpine.$data(host).$tooltip.open = true;
            await tick();

            const arrowElement = overlay().querySelector('[data-isas-floating-arrow]');
            const middleware = floating.computePosition.mock.calls[0][2].middleware;
            expect(middleware.map(({ name }) => name)).toEqual(['offset', 'flip', 'arrow']);
            expect(middleware[2].options.element).toBe(arrowElement);
            expect(arrowElement.style.top).toBe('13px');
            expect(arrowElement.style.left).toBe('-0.25rem');
        } finally {
            Isas.adapters.register('tooltip', tooltipAdapter, { replace: true });
        }
    });

    it('shares automatic and writable $tooltip state and allows only one active tooltip', async () => {
        const root = mount(`
            <div>
                <button id="one" x-is="button" tooltip="One">One</button>
                <button id="two" x-is="button" tooltip="Two">Two</button>
            </div>
        `);
        await tick();

        const one = root.querySelector('#one');
        const two = root.querySelector('#two');
        const oneData = Alpine.$data(one);
        const twoData = Alpine.$data(two);

        one.dispatchEvent(new Event('focusin'));
        await tick();
        expect(oneData.$tooltip.open).toBe(true);

        twoData.$tooltip.open = true;
        await tick();
        expect(oneData.$tooltip.open).toBe(false);
        expect(twoData.$tooltip.open).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await tick();
        expect(twoData.$tooltip.open).toBe(false);

        oneData.$tooltip.open = true;
        await tick();
        oneData.$tooltip.open = false;
        expect(oneData.$tooltip.open).toBe(false);
    });

    it('stays open while pointer or focus traverses into interactive tooltip content', async () => {
        const host = mount(`
            <button x-is="button" tooltip>
                Trigger
                <template slot="tooltip">
                    <button id="tooltip-control">Control</button>
                </template>
            </button>
        `);
        await tick();
        const tooltip = overlay();
        const content = tooltip.querySelector('[data-isas-tooltip-content]');
        const control = content.querySelector('#tooltip-control');

        host.dispatchEvent(new Event('pointerenter'));
        await tick();
        host.dispatchEvent(new Event('pointerleave'));
        tooltip.dispatchEvent(new Event('pointerenter'));
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(Alpine.$data(host).$tooltip.open).toBe(true);
        expect(tooltip.style.pointerEvents).toBe('none');
        expect(content.style.pointerEvents).toBe('auto');

        tooltip.dispatchEvent(new Event('pointerleave'));
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(Alpine.$data(host).$tooltip.open).toBe(false);

        host.dispatchEvent(new Event('focusin'));
        await tick();
        host.dispatchEvent(new FocusEvent('focusout', { relatedTarget: control }));
        control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(Alpine.$data(host).$tooltip.open).toBe(true);

        control.dispatchEvent(new FocusEvent('focusout', {
            bubbles: true,
            relatedTarget: document.body,
        }));
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(Alpine.$data(host).$tooltip.open).toBe(false);
    });

    it('uses native popover methods when available', async () => {
        const showPopover = vi.fn();
        const hidePopover = vi.fn();
        const previousShow = HTMLElement.prototype.showPopover;
        const previousHide = HTMLElement.prototype.hidePopover;
        HTMLElement.prototype.showPopover = showPopover;
        HTMLElement.prototype.hidePopover = hidePopover;

        try {
            const host = mount('<button x-is="button" tooltip="Native">Trigger</button>');
            await tick();
            Alpine.$data(host).$tooltip.open = true;
            await tick();
            expect(showPopover).toHaveBeenCalledOnce();
            expect(overlay().classList).toContain('tooltip-open');

            Alpine.$data(host).$tooltip.open = false;
            expect(hidePopover).toHaveBeenCalledOnce();
            expect(overlay().classList).not.toContain('tooltip-open');
        } finally {
            if (previousShow) HTMLElement.prototype.showPopover = previousShow;
            else delete HTMLElement.prototype.showPopover;
            if (previousHide) HTMLElement.prototype.hidePopover = previousHide;
            else delete HTMLElement.prototype.hidePopover;
        }
    });

    it('works on void primary hosts and restores described-by during cleanup', async () => {
        const host = mount(`
            <hr x-is="divider" aria-describedby="existing" tooltip="Divider help">
        `);
        await tick();

        const tooltip = overlay();
        expect(host.children).toHaveLength(0);
        expect(host.getAttribute('aria-describedby').split(/\s+/))
            .toEqual(['existing', tooltip.id]);

        host.removeAttribute('tooltip');
        await tick();
        expect(host.getAttribute('aria-describedby')).toBe('existing');
        expect(overlay()).toBeNull();
    });

    it('updates rich content through source adoption and permits adapter replacement', async () => {
        Isas.adapters.register('tooltip', ({ attrs }) => ({
            host: { class: ['replacement-tooltip', attrs.get('color')] },
            parts: {
                content: { class: 'replacement-content' },
                arrow: { class: 'replacement-arrow' },
            },
        }), { replace: true });

        try {
            const host = mount(`
                <button x-is="button" tooltip tooltip:color="custom">
                    Trigger
                    <template slot="tooltip"><strong>Before</strong></template>
                </button>
            `);
            await tick();

            expect(overlay().classList.contains('replacement-tooltip')).toBe(true);
            expect(overlay().classList.contains('tooltip')).toBe(false);
            expect(overlay().querySelector('.replacement-content').textContent).toContain('Before');

            const incoming = document.createElement('button');
            incoming.setAttribute('x-is', 'button');
            incoming.setAttribute('tooltip', '');
            incoming.setAttribute('tooltip:color', 'custom');
            incoming.innerHTML = `
                Trigger
                <template slot="tooltip"><strong>After</strong></template>
            `;
            expect(HostRuntime.from(host).adoptSource(incoming)).toBe(true);
            await tick();

            expect(overlay().querySelector('.replacement-content').textContent).toContain('After');
        } finally {
            Isas.adapters.register('tooltip', tooltipAdapter, { replace: true });
        }
    });

    it('reconciles nested x-is runtimes when rich server content changes', async () => {
        const host = mount(`
            <button x-is="button" tooltip>
                Trigger
                <template slot="tooltip">
                    <small x-is="countdown" value="10"></small>
                </template>
            </button>
        `);
        await tick();

        const initialCountdown = overlay().querySelector('[x-is="countdown"]');
        expect(initialCountdown.textContent).toBe('');
        expect(initialCountdown.querySelectorAll('span')[0].style.getPropertyValue('--value'))
            .toBe('1');

        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.setAttribute('tooltip', '');
        incoming.innerHTML = `
            Trigger
            <template slot="tooltip">
                <small x-is="countdown" value="29"></small>
            </template>
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        const updatedCountdown = overlay().querySelector('[x-is="countdown"]');
        expect(updatedCountdown).toBe(initialCountdown);
        expect(updatedCountdown.querySelectorAll('span')[0].style.getPropertyValue('--value'))
            .toBe('2');
        expect(updatedCountdown.querySelectorAll('span')[1].style.getPropertyValue('--value'))
            .toBe('9');
    });

    it('destroys a teleported trigger runtime before Livewire removes its subtree', async () => {
        let morphRemoving;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.removing') morphRemoving = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        try {
            document.body.innerHTML = `
                <div id="tooltip-teleport-target"></div>
                <div wire:id="teleport-demo">
                    <template x-teleport="#tooltip-teleport-target">
                        <div data-teleported-dialog>
                            <button x-is="button" tooltip="Save the portal">Save</button>
                        </div>
                    </template>
                </div>
            `;
            Alpine.initTree(document.body);
            await tick();

            const wrapper = document.querySelector('[data-teleported-dialog]');
            const trigger = wrapper.querySelector('[x-is="button"]');
            const tooltip = overlay();

            trigger.dispatchEvent(new Event('pointerenter'));
            await tick();
            expect(tooltip.hasAttribute('data-open')).toBe(true);

            morphRemoving({ el: wrapper });

            expect(HostRuntime.from(trigger)).toBeNull();
            expect(overlay()).toBeNull();
        } finally {
            delete globalThis.Livewire;
        }
    });
});
