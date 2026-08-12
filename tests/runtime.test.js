import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, {
    AttributeBag,
    Avatar,
    avatarAdapter,
    Badge,
    badgeAdapter,
    Button,
    buttonAdapter,
    Component,
    Countdown,
    countdownAdapter,
    Divider,
    dividerAdapter,
    HostRuntime,
    Isas,
    normalizeAttachmentSpec,
    SLOT_CONTEXT_ATTRIBUTE,
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

describe('primitive components and slots', () => {
    it('applies the button presentation recipe while preserving explicit classes', async () => {
        const host = mount(`
            <button class="explicit-classes" x-is="button" color="primary" size="xs"
                icon="i-tabler-plus" icon:class="mr-2">
                Click Me
            </button>
        `);
        await tick();

        expect(host.className).toBe('btn btn-primary btn-xs explicit-classes');
        expect(host.firstElementChild.className).toBe('inline-flex items-center justify-center');
        expect(host.firstElementChild.firstElementChild.className).toBe('i-tabler-plus mr-2');
        expect(host.textContent).toContain('Click Me');
    });

    it('replaces stale mapped classes without disturbing authored or externally resolved classes', async () => {
        const root = mount(`
            <div x-data="{ currentColor: 'primary', currentVariant: 'soft' }">
                <button x-is="button" class="explicit" :color="currentColor"
                    :variant="currentVariant" size="xs">Label</button>
            </div>
        `);
        await tick();

        const host = root.querySelector('button');
        expect(host.classList.contains('btn')).toBe(true);
        expect(host.classList.contains('btn-primary')).toBe(true);
        expect(host.classList.contains('btn-xs')).toBe(true);
        expect(host.classList.contains('btn-soft')).toBe(true);
        expect(host.classList.contains('explicit')).toBe(true);

        host.setAttribute('class', `${host.className} emphasized`);
        await tick();
        expect(host.classList.contains('emphasized')).toBe(true);

        Alpine.$data(root).currentColor = 'secondary';
        Alpine.$data(root).currentVariant = 'outline';
        host.removeAttribute('size');
        await tick();

        expect(host.classList.contains('btn')).toBe(true);
        expect(host.classList.contains('btn-secondary')).toBe(true);
        expect(host.classList.contains('btn-primary')).toBe(false);
        expect(host.classList.contains('btn-xs')).toBe(false);
        expect(host.classList.contains('btn-outline')).toBe(true);
        expect(host.classList.contains('btn-soft')).toBe(false);
        expect(host.classList.contains('explicit')).toBe(true);
        expect(host.classList.contains('emphasized')).toBe(true);
        expect(HostRuntime.from(host).source.attributes.get('class')).toBe('explicit emphasized');
    });

    it('merges declarative host and named-part adapter attributes under authored values', async () => {
        class PresentedButton extends Button {}
        Isas.components.register('test-presented-button', PresentedButton);
        Isas.adapters.register('test-presented-button', () => ({
            host: AttributeBag.from({
                class: 'presented',
                title: 'adapter',
                style: 'display: inline-flex',
            }),
            parts: {
                icon: AttributeBag.from({
                    class: 'adapter-icon',
                    title: 'adapter-icon-title',
                }),
                prepend: { class: 'adapter-prepend' },
                append: { class: 'adapter-append' },
            },
        }));

        const host = mount(`
            <button x-is="test-presented-button" class="explicit" title="authored"
                style="color: red" icon="icon" icon:class="authored-icon"
                icon:title="authored-icon-title" prepend:class="authored-prepend"
                append:class="authored-append">
                Label <small slot="append">End</small>
            </button>
        `);
        await tick();

        expect(host.className).toBe('presented explicit');
        expect(host.title).toBe('authored');
        expect(host.getAttribute('style')).toContain('display: inline-flex');
        expect(host.getAttribute('style')).toContain('color: red');
        expect(host.firstElementChild.className).toBe('adapter-prepend authored-prepend');
        expect(host.firstElementChild.firstElementChild.className)
            .toBe('icon adapter-icon authored-icon');
        expect(host.firstElementChild.firstElementChild.title).toBe('authored-icon-title');
        expect(host.lastElementChild.className).toBe('adapter-append authored-append');
    });

    it('promotes icon and append content with namespaced attributes', async () => {
        const host = mount(`
            <button x-is="button" icon="i-tabler-info-circle"
                icon:class="animate-pulse" prepend:class="mr-2" append:class="ml-2"
                wire:click="increment">
                Click Me
                <span x-is="badge" slot="append">0</span>
            </button>
        `);
        await tick();

        expect(host.getAttribute('icon')).toBe('i-tabler-info-circle');
        expect(host.getAttribute('icon:class')).toBe('animate-pulse');
        expect(host.getAttribute('wire:click')).toBe('increment');
        expect(host.children).toHaveLength(2);
        expect(host.children[0].className)
            .toBe('inline-flex items-center justify-center mr-2');
        expect(host.children[0].firstElementChild.className).toBe('i-tabler-info-circle animate-pulse');
        expect(host.childNodes[1].textContent).toContain('Click Me');
        expect(host.children[1].className)
            .toBe('inline-flex items-center justify-center ml-2');
        expect(host.children[1].firstElementChild.getAttribute('x-is')).toBe('badge');
        expect(host.children[1].firstElementChild.hasAttribute('slot')).toBe(false);
    });

    it('exposes logical named-slot context to nested component adapters', async () => {
        class SlotAware extends Component {}
        Isas.components.register('test-slot-aware', SlotAware);
        Isas.adapters.register('test-slot-aware', ({ attrs }) => ({
            host: {
                'data-adapter-slot': attrs.get(SLOT_CONTEXT_ATTRIBUTE, 'default'),
            },
        }));

        const host = mount(`
            <button x-is="button">
                Label
                <span id="slot-probe" x-is="test-slot-aware" wire:key="slot-probe"
                    slot="append">
                    <i data-alpine-state
                        x-text="String('dataIsasSlot' in $testSlotAware)"></i>
                </span>
            </button>
        `);
        await tick();

        const runtime = HostRuntime.from(host);
        const probe = host.querySelector('#slot-probe');
        expect(probe.hasAttribute('slot')).toBe(false);
        expect(probe.getAttribute(SLOT_CONTEXT_ATTRIBUTE)).toBe('append');
        expect(probe.dataset.adapterSlot).toBe('append');
        expect(probe.querySelector('[data-alpine-state]').textContent).toBe('false');
        expect(runtime.source.innerHTML()).toContain('slot="append"');
        expect(runtime.source.innerHTML()).not.toContain(SLOT_CONTEXT_ATTRIBUTE);

        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.innerHTML = `
            <span id="slot-probe" x-is="test-slot-aware" wire:key="slot-probe"
                slot="prepend">
                <i data-alpine-state
                    x-text="String('dataIsasSlot' in $testSlotAware)"></i>
            </span>
            Updated
        `;

        expect(runtime.reconcileFrom(incoming)).toBe(true);
        await tick();

        const updatedProbe = host.querySelector('#slot-probe');
        expect(updatedProbe.hasAttribute('slot')).toBe(false);
        expect(updatedProbe.getAttribute(SLOT_CONTEXT_ATTRIBUTE)).toBe('prepend');
        expect(updatedProbe.dataset.adapterSlot).toBe('prepend');
        expect(runtime.source.innerHTML()).toContain('slot="prepend"');
        expect(runtime.source.innerHTML()).not.toContain(SLOT_CONTEXT_ATTRIBUTE);

        Alpine.destroyTree(host);
        expect(host.innerHTML).toContain('slot="prepend"');
        expect(host.innerHTML).not.toContain(SLOT_CONTEXT_ATTRIBUTE);
    });

    it('promotes icon-end into append while preserving namespaced attributes', async () => {
        const host = mount(`
            <button x-is="button" variant="outline" icon-end="i-tabler-arrow-right"
                icon-end:class="text-lg" icon-end:title="Continue"
                append:class="authored-append">
                Next
            </button>
        `);
        await tick();

        expect(host.className).toBe('btn btn-outline');
        expect(host.lastElementChild.className)
            .toBe('inline-flex items-center justify-center authored-append');
        expect(host.lastElementChild.firstElementChild.className)
            .toBe('i-tabler-arrow-right text-lg');
        expect(host.lastElementChild.firstElementChild.title).toBe('Continue');
    });

    it('lets authored accessory slots override both icon convenience attributes', async () => {
        const host = mount(`
            <button x-is="button" icon="generated-start" icon-end="generated-end">
                <strong slot="prepend" class="authored-start">Start</strong>
                Label
                <strong slot="append" class="authored-end">End</strong>
            </button>
        `);
        await tick();

        expect(host.querySelector('.generated-start')).toBeNull();
        expect(host.querySelector('.generated-end')).toBeNull();
        expect(host.firstElementChild.firstElementChild.matches('strong.authored-start')).toBe(true);
        expect(host.lastElementChild.firstElementChild.matches('strong.authored-end')).toBe(true);
    });

    it('lets an authored prepend slot override the icon convenience attribute', async () => {
        const host = mount(`
            <button x-is="button" icon="generated">
                <strong slot="prepend" class="authored">A</strong>
                Label
            </button>
        `);
        await tick();

        expect(host.querySelector('.generated')).toBeNull();
        expect(host.firstElementChild.firstElementChild.matches('strong.authored')).toBe(true);
        expect(host.querySelector('[slot]')).toBeNull();
    });

    it('reacts to Alpine-resolved attributes after the component scope exists', async () => {
        const root = mount(`
            <div x-data="{ currentIcon: 'icon-one' }">
                <button id="bound" x-is="button" :icon="currentIcon">
                    <span x-text="$button.icon"></span>
                </button>
                <button id="change" @click="currentIcon = 'icon-two'"></button>
            </div>
        `);
        await tick();

        const host = root.querySelector('#bound');
        expect(host.querySelector('.icon-one')).not.toBeNull();
        expect(host.textContent).toContain('icon-one');

        root.querySelector('#change').click();
        await tick();
        expect(host.querySelector('.icon-two')).not.toBeNull();
        expect(host.textContent).toContain('icon-two');
    });
});

describe('adapter render descriptors', () => {
    it('renders a custom button from prepared semantic slots and memoizes renderDefault', async () => {
        let defaultRenderCalls = 0;
        let customRenderCalls = 0;
        const memoizedResults = [];

        class SkinnedButton extends Button {
            render() {
                defaultRenderCalls += 1;
                return super.render();
            }
        }

        Isas.components.register('test-skinned-button', SkinnedButton);
        Isas.adapters.register('test-skinned-button', {
            attributes(context) {
                const defaults = buttonAdapter(context);
                return {
                    host: AttributeBag.from(defaults.host).class('custom-host'),
                    parts: {
                        ...defaults.parts,
                        icon: { class: 'adapter-icon', title: 'adapter-title' },
                        prepend: AttributeBag.from(defaults.parts.prepend)
                            .class('adapter-prepend'),
                    },
                };
            },
            render({ attrs, slots, view, renderDefault }) {
                customRenderCalls += 1;
                const first = renderDefault();
                const second = renderDefault();
                memoizedResults.push(first === second);

                return `
                    <span class="custom-shell" data-prepared="${view.hasPrepend}">
                        <span data-part="prepend" ${attrs.for('prepend').toString()}>
                            ${slots.get('prepend').html()}
                        </span>
                        <span data-part="default">${slots.get('default').html()}</span>
                    </span>
                `;
            },
        });

        const host = mount(`
            <button x-is="test-skinned-button" color="primary" icon="start-icon"
                icon:class="authored-icon" icon:title="authored-title"
                prepend:class="authored-prepend">Save</button>
        `);
        await tick();

        expect(host.className).toBe('btn btn-primary custom-host');
        expect(host.querySelector('.custom-shell').dataset.prepared).toBe('true');
        expect(host.querySelector('[data-part="prepend"]').className)
            .toBe('inline-flex items-center justify-center adapter-prepend authored-prepend');
        expect(host.querySelector('.start-icon').className)
            .toBe('start-icon adapter-icon authored-icon');
        expect(host.querySelector('.start-icon').title).toBe('authored-title');
        expect(host.querySelector('[data-part="default"]').textContent).toContain('Save');
        expect(defaultRenderCalls).toBe(customRenderCalls);
        expect(memoizedResults.every(Boolean)).toBe(true);
        expect(HostRuntime.from(host).source.innerHTML()).toContain('Save');
        expect(HostRuntime.from(host).source.innerHTML()).not.toContain('custom-shell');
    });

    it('treats undefined as no update, null as empty, and renderDefault as explicit fallback', async () => {
        class RenderResultComponent extends Component {
            static structural = true;

            render() {
                return `<strong class="default-output">${this.slots.get('default').html()}</strong>`;
            }
        }

        Isas.components.register('test-render-results', RenderResultComponent);
        Isas.adapters.register('test-render-results', {
            render({ attrs, slots, renderDefault }) {
                if (attrs.get('mode') === 'preserve') return undefined;
                if (attrs.get('mode') === 'empty') return null;
                if (attrs.get('mode') === 'default') return renderDefault();
                return `<em class="custom-output">${slots.get('default').html()}</em>`;
            },
        });

        const host = mount('<div x-is="test-render-results">Authored</div>');
        await tick();
        expect(host.querySelector('.custom-output').textContent).toBe('Authored');

        host.setAttribute('mode', 'preserve');
        await tick();
        expect(host.querySelector('.custom-output').textContent).toBe('Authored');

        host.setAttribute('mode', 'empty');
        await tick();
        expect(host.childNodes).toHaveLength(0);

        host.setAttribute('mode', 'default');
        await tick();
        expect(host.querySelector('.default-output').textContent).toBe('Authored');
        expect(HostRuntime.from(host).source.innerHTML()).toBe('Authored');
    });

    it('propagates custom renderer errors without invoking the default renderer', async () => {
        let defaultRenderCalls = 0;

        class FailingRenderComponent extends Component {
            static structural = true;

            render() {
                defaultRenderCalls += 1;
                return '<span class="default-output"></span>';
            }
        }

        Isas.components.register('test-render-error', FailingRenderComponent);
        Isas.adapters.register('test-render-error', {
            render({ attrs }) {
                if (attrs.has('fail')) throw new Error('Custom renderer failed.');
                return '<span class="custom-output"></span>';
            },
        });

        const host = mount('<div x-is="test-render-error"></div>');
        await tick();
        const runtime = HostRuntime.from(host);
        runtime.source.setAttribute('fail', '');

        expect(() => runtime.renderNow()).toThrow('Custom renderer failed.');
        expect(defaultRenderCalls).toBe(0);
    });

    it('gives custom badge renderers resolved slots while authored slots stay authoritative', async () => {
        class SkinnedBadge extends Badge {}

        Isas.components.register('test-skinned-badge', SkinnedBadge);
        Isas.adapters.register('test-skinned-badge', {
            attributes: badgeAdapter,
            render({ slots, view }) {
                return `
                    <span class="custom-badge" data-prepend="${view.hasPrepend}"
                        data-append="${view.hasAppend}">
                        ${slots.get('prepend').html()}
                        <b>${slots.get('default').html()}</b>
                        ${slots.get('append').html()}
                    </span>
                `;
            },
        });

        const host = mount(`
            <span x-is="test-skinned-badge" color="success" icon="generated-start"
                icon-end="generated-end" icon-end:class="authored-end-icon">
                <i slot="prepend" class="authored-start"></i>
                Ready
            </span>
        `);
        await tick();

        expect(host.className).toBe('badge badge-success');
        expect(host.querySelector('.custom-badge').dataset.prepend).toBe('true');
        expect(host.querySelector('.custom-badge').dataset.append).toBe('true');
        expect(host.querySelector('.generated-start')).toBeNull();
        expect(host.querySelector('.authored-start')).not.toBeNull();
        expect(host.querySelector('.generated-end.authored-end-icon')).not.toBeNull();
        expect(host.querySelector('b').textContent).toContain('Ready');
    });

    it('reconciles custom markup without duplicating wrappers or replacing nested runtimes', async () => {
        class ReconciledButton extends Button {}

        Isas.components.register('test-render-reconcile', ReconciledButton);
        Isas.adapters.register('test-render-reconcile', {
            attributes: buttonAdapter,
            render({ slots }) {
                return `<span class="custom-shell">${slots.get('prepend').html()}${slots.get('default').html()}</span>`;
            },
        });

        const root = mount(`
            <div x-data="{ count: 1 }">
                <button x-is="test-render-reconcile" icon="icon-one">
                    Count <span x-is="badge" x-text="count"></span>
                </button>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="test-render-reconcile"]');
        const badge = host.querySelector('[x-is="badge"]');
        expect(badge.textContent).toBe('1');

        Alpine.$data(root).count = 2;
        host.setAttribute('color', 'primary');
        await tick();
        expect(host.querySelectorAll('.custom-shell')).toHaveLength(1);
        expect(host.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('2');

        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'test-render-reconcile');
        incoming.setAttribute('icon', 'icon-two');
        incoming.innerHTML = 'Updated <span x-is="badge" x-text="count"></span>';

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();
        expect(host.querySelectorAll('.custom-shell')).toHaveLength(1);
        expect(host.querySelector('.icon-one')).toBeNull();
        expect(host.querySelector('.icon-two')).not.toBeNull();
        expect(host.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('2');
        expect(HostRuntime.from(host).source.innerHTML()).not.toContain('custom-shell');
    });

    it('exposes prepared countdown parts to a custom renderer across bindings', async () => {
        class SkinnedCountdown extends Countdown {}

        Isas.components.register('test-skinned-countdown', SkinnedCountdown);
        Isas.adapters.register('test-skinned-countdown', {
            attributes: countdownAdapter,
            render({ view }) {
                return view.parts.map((part) => (
                    `<i data-part-type="${part.type}">${part.value}</i>`
                )).join('');
            },
        });

        const root = mount(`
            <div x-data="{ remaining: '10:09' }">
                <span x-is="test-skinned-countdown" :value="remaining"></span>
                <button @click="remaining = '08s'"></button>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="test-skinned-countdown"]');
        expect(host.className).toBe('countdown font-mono');
        expect([...host.children].map((element) => [element.dataset.partType, element.textContent]))
            .toEqual([
                ['digit', '1'], ['digit', '0'], ['text', ':'], ['digit', '0'], ['digit', '9'],
            ]);

        root.querySelector('button').click();
        await tick();
        expect([...host.children].map((element) => [element.dataset.partType, element.textContent]))
            .toEqual([['digit', '0'], ['digit', '8'], ['text', 's']]);
    });
});

describe('badge presentation', () => {
    it.each([
        ['outline', 'btn-outline', 'badge-outline'],
        ['dash', 'btn-dash', 'badge-dash'],
        ['soft', 'btn-soft', 'badge-soft'],
        ['ghost', 'btn-ghost', 'badge-ghost'],
        ['link', 'btn-link', 'badge-link'],
    ])('maps the %s variant for button and badge', async (variant, buttonClass, badgeClass) => {
        const root = mount(`
            <div>
                <button x-is="button" variant="${variant}">Button</button>
                <span x-is="badge" variant="${variant}">Badge</span>
            </div>
        `);
        await tick();

        expect(root.querySelector('button').classList.contains(buttonClass)).toBe(true);
        expect(root.querySelector('[x-is="badge"]').classList.contains(badgeClass)).toBe(true);
    });

    it('maps validated color and size values while preserving explicit classes', async () => {
        const host = mount(`
            <span x-is="badge" class="explicit" color="success" size="sm"
                variant="soft">Ready</span>
        `);
        await tick();

        expect(host.className).toBe('badge badge-success badge-sm badge-soft explicit');

        host.setAttribute('color', 'error');
        host.setAttribute('size', 'unknown');
        host.setAttribute('variant', 'outline');
        await tick();

        expect(host.className).toBe('badge badge-error badge-outline explicit');
        expect(host.classList.contains('badge-success')).toBe(false);
        expect(host.classList.contains('badge-sm')).toBe(false);
        expect(host.classList.contains('badge-soft')).toBe(false);
    });

    it('renders icon and icon-end with presentation part defaults', async () => {
        const host = mount(`
            <span x-is="badge" color="info" icon="i-tabler-info-circle"
                icon:class="text-sm" prepend:class="authored-prepend"
                icon-end="i-tabler-x" icon-end:aria-label="Dismiss"
                append:class="authored-append">
                Review
            </span>
        `);
        await tick();

        expect(host.children).toHaveLength(2);
        expect(host.firstElementChild.className)
            .toBe('inline-flex items-center justify-center authored-prepend');
        expect(host.firstElementChild.firstElementChild.className)
            .toBe('i-tabler-info-circle text-sm');
        expect(host.lastElementChild.className)
            .toBe('inline-flex items-center justify-center authored-append');
        expect(host.lastElementChild.firstElementChild.className).toBe('i-tabler-x');
        expect(host.lastElementChild.firstElementChild.getAttribute('aria-label')).toBe('Dismiss');
        expect(host.textContent).toContain('Review');
    });

});

describe('divider component', () => {
    it.each([
        ['neutral', 'divider-neutral'],
        ['primary', 'divider-primary'],
        ['secondary', 'divider-secondary'],
        ['accent', 'divider-accent'],
        ['success', 'divider-success'],
        ['warning', 'divider-warning'],
        ['info', 'divider-info'],
        ['error', 'divider-error'],
    ])('maps the %s color', async (color, expectedClass) => {
        const host = mount(`<div x-is="divider" color="${color}"></div>`);
        await tick();

        expect(host.classList.contains('divider')).toBe(true);
        expect(host.classList.contains('divider-vertical')).toBe(true);
        expect(host.classList.contains(expectedClass)).toBe(true);
    });

    it('maps direction, placement, and adaptive spacing while preserving authored styling', async () => {
        const host = mount(`
            <div x-is="divider" class="explicit" direction="horizontal"
                placement="start" color="primary" adaptive
                style="color: red">OR</div>
        `);
        await tick();

        expect(host.className)
            .toBe('divider divider-primary divider-horizontal divider-start explicit');
        expect(host.style.getPropertyValue('--divider-m')).toBe('0 0.5em');
        expect(host.style.color).toBe('red');

        host.setAttribute('direction', 'vertical');
        host.setAttribute('placement', 'end');
        host.setAttribute('color', 'error');
        await tick();

        expect(host.className)
            .toBe('divider divider-error divider-vertical divider-end explicit');
        expect(host.style.getPropertyValue('--divider-m')).toBe('0.5em 0');

        host.setAttribute('direction', 'unknown');
        host.setAttribute('placement', 'middle');
        host.setAttribute('color', 'unknown');
        host.setAttribute('adaptive', 'false');
        await tick();

        expect(host.className).toBe('divider divider-vertical explicit');
        expect(host.style.getPropertyValue('--divider-m')).toBe('');
        expect(host.style.color).toBe('red');
    });

    it('uses an escaped label only when the default slot has no visible content', async () => {
        const labelled = mount(`
            <div x-is="divider" label="&lt;strong&gt;unsafe &amp; quoted&lt;/strong&gt;">
                <!--[if BLOCK]><![endif]-->
                <!--[if ENDBLOCK]><![endif]-->
            </div>
        `);
        await tick();

        expect(labelled.textContent).toBe('<strong>unsafe & quoted</strong>');
        expect(labelled.querySelector('strong')).toBeNull();
        expect(HostRuntime.from(labelled).component.view.contentSource).toBe('label');

        Alpine.destroyTree(labelled);
        document.body.replaceChildren();

        const authored = mount(`
            <div x-is="divider" label="Fallback"><strong>Authored</strong></div>
        `);
        await tick();

        expect(authored.innerHTML).toBe('<strong>Authored</strong>');
        expect(HostRuntime.from(authored).component.view.contentSource).toBe('authored');
    });

    it('reacts to a bound label while using the component scope default', async () => {
        const root = mount(`
            <div x-data="{ label: 'First' }">
                <div x-is="divider" :label="label"></div>
                <button @click="label = 'Second'"></button>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="divider"]');
        expect(host.textContent).toBe('First');
        expect('$divider' in Alpine.$data(host)).toBe(false);
        expect('$host' in Alpine.$data(host)).toBe(false);

        root.querySelector('button').click();
        await tick();
        expect(host.textContent).toBe('Second');
    });

    it('allows the scoped modifier to override the component default', async () => {
        const host = mount(`
            <div x-is.scoped="divider" label="Scoped"></div>
        `);
        await tick();

        expect(Alpine.$data(host).$host.label).toBe('Scoped');
        expect(Alpine.$data(host).$divider.label).toBe('Scoped');
        expect(host.textContent.trim()).toBe('Scoped');
    });

    it.each([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
        'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
    ])('never renders label content into the <%s> void host', async (tag) => {
        const host = document.createElement(tag);
        host.setAttribute('x-is', 'divider');
        host.setAttribute('label', 'Ignored');
        host.setAttribute('color', 'secondary');
        document.body.append(host);
        Alpine.initTree(host);
        await tick();

        expect(host.childNodes).toHaveLength(0);
        expect(host.classList.contains('divider')).toBe(true);
        expect(host.classList.contains('divider-secondary')).toBe(true);
        expect(HostRuntime.from(host).component.view).toEqual({
            isVoid: true,
            contentSource: 'void',
        });
    });

    it('exposes resolved label content and view state to a custom renderer', async () => {
        class SkinnedDivider extends Divider {}

        Isas.components.register('test-skinned-divider', SkinnedDivider);
        Isas.adapters.register('test-skinned-divider', {
            attributes: dividerAdapter,
            render({ slots, view }) {
                return `<span data-source="${view.contentSource}"
                    data-void="${view.isVoid}">${slots.get('default').html()}</span>`;
            },
        });

        const host = mount(`
            <div x-is="test-skinned-divider" label="Custom &amp; safe"></div>
        `);
        await tick();

        expect(host.className).toBe('divider divider-vertical');
        expect(host.firstElementChild.dataset.source).toBe('label');
        expect(host.firstElementChild.dataset.void).toBe('false');
        expect(host.firstElementChild.textContent).toBe('Custom & safe');
    });

    it('reconciles canonical label and presentation updates without stale output', async () => {
        const host = mount(`
            <div x-is="divider" label="First" color="primary" adaptive></div>
        `);
        await tick();

        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'divider');
        incoming.setAttribute('label', 'Second');
        incoming.setAttribute('color', 'error');

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.textContent).toBe('Second');
        expect(host.classList.contains('divider-primary')).toBe(false);
        expect(host.classList.contains('divider-error')).toBe(true);
        expect(host.style.getPropertyValue('--divider-m')).toBe('');
        expect(HostRuntime.from(host).source.innerHTML()).toBe('');

        Alpine.destroyTree(host);
        expect(host.innerHTML).toBe('');
    });
});

describe('avatar component', () => {
    it.each([
        ['xs', 'size-6', 'text-xs'],
        ['sm', 'size-8', 'text-xs'],
        ['md', 'size-10', 'text-sm'],
        ['lg', 'size-12', 'text-sm'],
        ['xl', 'size-14', 'text-base'],
        ['adaptive', 'size-[2.25em]', 'text-[0.65em]'],
    ])('maps the %s size onto the content part', async (size, dimension, textSize) => {
        const host = mount(`<div x-is="avatar" size="${size}">A</div>`);
        await tick();

        expect(host.firstElementChild.classList.contains(dimension)).toBe(true);
        expect(host.firstElementChild.classList.contains(textSize)).toBe(true);
    });

    it.each([
        ['neutral', 'bg-neutral', 'text-neutral-content'],
        ['primary', 'bg-primary', 'text-primary-content'],
        ['secondary', 'bg-secondary', 'text-secondary-content'],
        ['accent', 'bg-accent', 'text-accent-content'],
        ['success', 'bg-success', 'text-success-content'],
        ['warning', 'bg-warning', 'text-warning-content'],
        ['error', 'bg-error', 'text-error-content'],
        ['info', 'bg-info', 'text-info-content'],
    ])('maps the %s color onto the content part', async (color, background, foreground) => {
        const host = mount(`<div x-is="avatar" color="${color}">A</div>`);
        await tick();

        expect(host.firstElementChild.classList.contains(background)).toBe(true);
        expect(host.firstElementChild.classList.contains(foreground)).toBe(true);
    });

    it('applies defaults, status, placeholder, and authored host/content classes', async () => {
        const host = mount(`
            <div x-is="avatar" class="host-authored" status="online"
                content:class="rounded-full content-authored">DX</div>
        `);
        await tick();

        expect(host.className).toBe('avatar avatar-online avatar-placeholder host-authored');
        expect(host.firstElementChild.className)
            .toBe('size-10 text-sm bg-neutral text-neutral-content rounded-full content-authored');
        expect(host.firstElementChild.textContent).toBe('DX');
        expect(host.children).toHaveLength(1);

        host.setAttribute('size', 'unknown');
        host.setAttribute('color', 'unknown');
        host.setAttribute('status', 'away');
        await tick();

        expect(host.className).toBe('avatar avatar-placeholder host-authored');
        expect(host.firstElementChild.className).toBe('rounded-full content-authored');
    });

    it('keeps authored content ahead of src and icon convenience values', async () => {
        const host = mount(`
            <div x-is="avatar" src="generated.png" icon="generated-icon">
                <strong class="authored-avatar">AU</strong>
            </div>
        `);
        await tick();

        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('.generated-icon')).toBeNull();
        expect(host.querySelector('strong.authored-avatar')).not.toBeNull();
        expect(host.classList.contains('avatar-placeholder')).toBe(true);
        expect(HostRuntime.from(host).component.view).toMatchObject({
            source: 'authored',
            hasImage: false,
            placeholder: true,
            hasContent: true,
        });
    });

    it('generates an image with namespaced attributes overriding convenience defaults', async () => {
        const host = mount(`
            <div x-is="avatar" src="default.png" alt="Default alt"
                image:src="authored.png" image:alt="Authored alt"
                image:class="object-top" image:loading="lazy"
                image:title="A &amp; B &quot;quoted&quot;"></div>
        `);
        await tick();

        const image = host.querySelector('img');
        expect(host.getAttribute('alt')).toBe('Default alt');
        expect(image.getAttribute('src')).toBe('authored.png');
        expect(image.alt).toBe('Authored alt');
        expect(image.className).toBe('object-top');
        expect(image.loading).toBe('lazy');
        expect(image.title).toBe('A & B "quoted"');
        expect(host.classList.contains('avatar-placeholder')).toBe(false);
        expect(HostRuntime.from(host).component.view).toMatchObject({
            source: 'image',
            hasImage: true,
            placeholder: false,
        });
    });

    it('uses host alt as the generated image default', async () => {
        const host = mount('<div x-is="avatar" src="profile.png" alt="Profile photo"></div>');
        await tick();

        expect(host.querySelector('img').alt).toBe('Profile photo');
    });

    it('generates an icon only when neither authored content nor src is available', async () => {
        const host = mount(`
            <div x-is="avatar" src="profile.png" icon="fallback-icon"
                icon:class="text-lg" icon:aria-label="Profile"></div>
        `);
        await tick();

        expect(host.querySelector('img')).not.toBeNull();
        expect(host.querySelector('.fallback-icon')).toBeNull();

        host.removeAttribute('src');
        await tick();

        const icon = host.querySelector('.fallback-icon');
        expect(host.querySelector('img')).toBeNull();
        expect(icon.className).toBe('fallback-icon text-lg');
        expect(icon.getAttribute('aria-label')).toBe('Profile');
        expect(host.classList.contains('avatar-placeholder')).toBe(true);
    });

    it('detects authored images and honors explicit placeholder overrides', async () => {
        const authoredImage = mount(`
            <div x-is="avatar"><picture><img src="authored.png" alt=""></picture></div>
        `);
        await tick();
        expect(authoredImage.classList.contains('avatar-placeholder')).toBe(false);

        Alpine.destroyTree(authoredImage);
        document.body.replaceChildren();

        const forcedImage = mount('<div x-is="avatar" src="profile.png" placeholder></div>');
        await tick();
        expect(forcedImage.classList.contains('avatar-placeholder')).toBe(true);

        Alpine.destroyTree(forcedImage);
        document.body.replaceChildren();

        const forcedInitials = mount('<div x-is="avatar" placeholder="false">DX</div>');
        await tick();
        expect(forcedInitials.classList.contains('avatar-placeholder')).toBe(false);
    });

    it('reacts to Alpine-bound content and presentation without stale classes or wrappers', async () => {
        const root = mount(`
            <div x-data="{
                src: 'one.png', icon: null, size: 'xs', color: 'primary',
                status: 'online', placeholder: false
            }">
                <div x-is="avatar" :src="src" :icon="icon" :size="size"
                    :color="color" :status="status" :placeholder="placeholder"></div>
                <button @click="src = null; icon = 'bound-icon'; size = 'xl';
                    color = 'error'; status = 'offline'; placeholder = true"></button>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="avatar"]');
        expect(host.querySelector('img').getAttribute('src')).toBe('one.png');
        expect(host.classList.contains('avatar-online')).toBe(true);
        expect(host.firstElementChild.classList.contains('size-6')).toBe(true);
        expect(host.firstElementChild.classList.contains('bg-primary')).toBe(true);

        root.querySelector('button').click();
        await tick();

        expect(host.children).toHaveLength(1);
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('.bound-icon')).not.toBeNull();
        expect(host.classList.contains('avatar-online')).toBe(false);
        expect(host.classList.contains('avatar-offline')).toBe(true);
        expect(host.classList.contains('avatar-placeholder')).toBe(true);
        expect(host.firstElementChild.classList.contains('size-6')).toBe(false);
        expect(host.firstElementChild.classList.contains('size-14')).toBe(true);
        expect(host.firstElementChild.classList.contains('bg-primary')).toBe(false);
        expect(host.firstElementChild.classList.contains('bg-error')).toBe(true);
    });

    it('ignores empty Livewire conditional markers when resolving image and icon modes', async () => {
        const blockStart = '<!--[if BLOCK]><![endif]-->';
        const blockEnd = '<!--[if ENDBLOCK]><![endif]-->';
        const host = mount(`
            <div x-is="avatar" src="livewire.png">${blockStart}${blockEnd}</div>
        `);
        await tick();

        expect(host.querySelector('img').getAttribute('src')).toBe('livewire.png');
        expect(HostRuntime.from(host).component.view).toMatchObject({
            source: 'image',
            hasContent: true,
        });

        const iconIncoming = document.createElement('div');
        iconIncoming.setAttribute('x-is', 'avatar');
        iconIncoming.setAttribute('icon', 'livewire-icon');
        iconIncoming.innerHTML = `${blockStart}${blockEnd}`;

        expect(HostRuntime.from(host).reconcileFrom(iconIncoming)).toBe(true);
        await tick();
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('.livewire-icon')).not.toBeNull();
        expect(HostRuntime.from(host).component.view.source).toBe('icon');

        const initialsIncoming = document.createElement('div');
        initialsIncoming.setAttribute('x-is', 'avatar');
        initialsIncoming.innerHTML = `${blockStart}LW${blockEnd}`;

        expect(HostRuntime.from(host).reconcileFrom(initialsIncoming)).toBe(true);
        await tick();
        expect(host.querySelector('.livewire-icon')).toBeNull();
        expect(host.firstElementChild.textContent).toBe('LW');
        expect(HostRuntime.from(host).component.view.source).toBe('authored');
    });

    it('exposes resolved slots and view state to a custom avatar renderer', async () => {
        class SkinnedAvatar extends Avatar {}

        Isas.components.register('test-skinned-avatar', SkinnedAvatar);
        Isas.adapters.register('test-skinned-avatar', {
            attributes: avatarAdapter,
            render({ slots, view }) {
                return `<figure class="custom-avatar" data-source="${view.source}"
                    data-placeholder="${view.placeholder}">${slots.get('default').html()}</figure>`;
            },
        });

        const host = mount(`
            <div x-is="test-skinned-avatar" src="custom.png" image:alt="Custom"></div>
        `);
        await tick();

        expect(host.className).toBe('avatar');
        expect(host.querySelector('figure.custom-avatar').dataset.source).toBe('image');
        expect(host.querySelector('figure.custom-avatar').dataset.placeholder).toBe('false');
        expect(host.querySelector('figure img').alt).toBe('Custom');
    });

    it('reconciles source changes without duplicate content or generated canonical markup', async () => {
        const host = mount(`
            <div x-is="avatar" src="one.png" status="online" content:class="rounded-full"></div>
        `);
        await tick();

        const content = host.firstElementChild;
        const image = host.querySelector('img');
        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'avatar');
        incoming.setAttribute('src', 'two.png');
        incoming.setAttribute('status', 'offline');
        incoming.setAttribute('content:class', 'rounded-full');

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.children).toHaveLength(1);
        expect(host.firstElementChild).toBe(content);
        expect(host.querySelector('img')).toBe(image);
        expect(image.getAttribute('src')).toBe('two.png');
        expect(host.classList.contains('avatar-online')).toBe(false);
        expect(host.classList.contains('avatar-offline')).toBe(true);
        expect(HostRuntime.from(host).source.innerHTML()).toBe('');
        expect(HostRuntime.from(host).source.innerHTML()).not.toContain('<img');

        Alpine.destroyTree(host);
        expect(host.innerHTML).toBe('');
    });

    it('preserves an avatar runtime when nested in a reconciled button slot', async () => {
        const host = mount(`
            <button x-is="button">
                <div x-is="avatar" slot="prepend" src="one.png"
                    content:class="rounded-full"></div>
                Profile
            </button>
        `);
        await tick();

        const avatar = host.querySelector('[x-is="avatar"]');
        const content = avatar.firstElementChild;
        const image = avatar.querySelector('img');
        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.innerHTML = `
            <div x-is="avatar" slot="prepend" src="two.png"
                content:class="rounded-full"></div>
            Updated profile
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.querySelector('[x-is="avatar"]')).toBe(avatar);
        expect(avatar.firstElementChild).toBe(content);
        expect(avatar.querySelector('img')).toBe(image);
        expect(image.getAttribute('src')).toBe('two.png');
        expect(avatar.hasAttribute('slot')).toBe(false);
        expect(host.textContent).toContain('Updated profile');
    });
});

describe('countdown component', () => {
    it('reacts to a value binding inherited from a parent Alpine scope', async () => {
        const root = mount(`
            <div x-data="{ remaining: '00:10' }">
                <span x-is="countdown" :value="remaining"></span>
                <button @click="remaining = remaining === '00:10' ? '00:09' : '00:10'">Toggle</button>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="countdown"]');
        expect(host.getAttribute('value')).toBe('00:10');
        expect([...host.querySelectorAll(':scope > span:not(.countdown-ignore)')]
            .map((element) => element.style.getPropertyValue('--value'))).toEqual(['0', '0', '1', '0']);

        root.querySelector('button').click();
        await tick();

        expect(host.getAttribute('value')).toBe('00:09');
        expect([...host.querySelectorAll(':scope > span:not(.countdown-ignore)')]
            .map((element) => element.style.getPropertyValue('--value'))).toEqual(['0', '0', '0', '9']);
    });

    it('preserves an unchanged bound value across Livewire source reconciliation', async () => {
        const root = mount(`
            <div x-data="{ remaining: '07' }">
                <span x-is="countdown" :value="remaining"></span>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="countdown"]');
        const firstDigit = host.firstElementChild;
        const incoming = document.createElement('span');
        incoming.setAttribute('x-is', 'countdown');
        incoming.setAttribute(':value', 'remaining');

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.getAttribute('value')).toBe('07');
        expect(host.firstElementChild).toBe(firstDigit);
        expect([...host.querySelectorAll(':scope > span:not(.countdown-ignore)')]
            .map((element) => element.style.getPropertyValue('--value'))).toEqual(['0', '7']);
    });

    it('preserves bound attributes on nested runtimes during a parent reconciliation', async () => {
        const root = mount(`
            <div x-data="{ remaining: '4', tone: 'primary' }">
                <button x-is="button">
                    Run
                    <small x-is="countdown" slot="prepend" :value="remaining"></small>
                    <span x-is="badge" slot="append" :color="tone">Stable</span>
                </button>
            </div>
        `);
        await tick();

        const button = root.querySelector('[x-is="button"]');
        const countdown = button.querySelector('[x-is="countdown"]');
        const badge = button.querySelector('[x-is="badge"]');
        const digit = countdown.firstElementChild;
        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.innerHTML = `
            Run
            <small x-is="countdown" slot="prepend" :value="remaining"></small>
            <span x-is="badge" slot="append" :color="tone" size="lg">Stable</span>
        `;

        button.setAttribute('data-loading', 'true');
        await tick();

        expect(countdown.getAttribute('value')).toBe('4');
        expect(countdown.firstElementChild).toBe(digit);
        expect(badge.getAttribute('color')).toBe('primary');
        expect(badge.classList.contains('badge-primary')).toBe(true);
        expect(badge.classList.contains('badge-lg')).toBe(false);

        expect(HostRuntime.from(button).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(button.querySelector('[x-is="countdown"]')).toBe(countdown);
        expect(countdown.getAttribute('value')).toBe('4');
        expect(countdown.firstElementChild).toBe(digit);
        expect(button.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.getAttribute('color')).toBe('primary');
        expect(badge.classList.contains('badge-primary')).toBe(true);
        expect(badge.classList.contains('badge-lg')).toBe(true);

        Alpine.$data(root).remaining = '5';
        Alpine.$data(root).tone = 'secondary';
        await tick();

        expect(countdown.firstElementChild).toBe(digit);
        expect(digit.style.getPropertyValue('--value')).toBe('5');
        expect(badge.classList.contains('badge-primary')).toBe(false);
        expect(badge.classList.contains('badge-secondary')).toBe(true);
    });

    it('lets a nested pass-through runtime update content without losing bound attributes', async () => {
        const root = mount(`
            <div x-data="{ tone: 'primary' }">
                <button x-is="button">
                    <span x-is="test-bound-pass-through" :data-tone="tone">Initial</span>
                </button>
            </div>
        `);
        await tick();

        const button = root.querySelector('[x-is="button"]');
        const child = button.querySelector('[x-is="test-bound-pass-through"]');
        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.innerHTML = `
            <span x-is="test-bound-pass-through" :data-tone="tone">Updated</span>
        `;

        expect(HostRuntime.from(button).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(button.querySelector('[x-is="test-bound-pass-through"]')).toBe(child);
        expect(child.getAttribute('data-tone')).toBe('primary');
        expect(child.textContent).toBe('Updated');
    });

    it('renders value digits and separator text for DaisyUI countdown styling', async () => {
        const host = mount('<span x-is="countdown" class="countdown" value="12:34:56"></span>');
        await tick();

        expect(host.className).toBe('countdown font-mono');
        expect(host.children).toHaveLength(8);
        expect([...host.querySelectorAll(':scope > span:not(.countdown-ignore)')]
            .map((element) => element.style.getPropertyValue('--value'))).toEqual(['1', '2', '3', '4', '5', '6']);
        expect([...host.querySelectorAll(':scope > .countdown-ignore')]
            .map((element) => element.textContent)).toEqual([':', ':']);
    });

    it('uses authored slot text when value is absent and escapes it as text', async () => {
        const host = mount(`
            <span x-is="countdown" class="countdown">launch <strong>T-10</strong>:09</span>
        `);
        await tick();

        expect(host.textContent).toBe('launch T-:');
        expect(host.querySelector('.countdown-ignore').textContent).toBe('launch T-');
        expect(host.querySelector('strong')).toBeNull();
        expect([...host.querySelectorAll(':scope > span:not(.countdown-ignore)')]
            .map((element) => element.style.getPropertyValue('--value'))).toEqual(['1', '0', '0', '9']);
    });

    it('reacts to value changes without stale presentation classes or duplicate nodes', async () => {
        const host = mount('<span x-is="countdown" value="8"></span>');
        await tick();

        expect(host.className).toBe('countdown font-mono');
        expect(host.children).toHaveLength(1);

        for (const value of ['09', '3s', '']) {
            host.setAttribute('value', value);
            await tick();

            const expectedParts = value.match(/\D+|\d/g) ?? [];
            expect(host.children).toHaveLength(expectedParts.length);
        }

        expect(host.textContent).toBe('');
    });

    it('adopts Livewire source updates while retaining one node per character part', async () => {
        const host = mount('<span x-is="countdown:timer" class="countdown" value="10"></span>');
        await tick();

        for (const value of ['09', '08']) {
            const incoming = document.createElement('span');
            incoming.setAttribute('x-is', 'countdown:timer');
            incoming.setAttribute('class', 'countdown');
            incoming.setAttribute('value', value);

            expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
            await tick();
            expect([...host.children].map((element) => element.style.getPropertyValue('--value')))
                .toEqual([...value]);
        }
    });

    it('preserves countdown digit nodes when nested in button slots', async () => {
        const root = mount(`
            <div>
                <button id="prepend-countdown" x-is="button">
                    <small x-is="countdown:launch" class="countdown" slot="prepend" value="0"></small>
                    Prepend
                </button>
                <button id="append-countdown" x-is="button">
                    Append
                    <small x-is="countdown:launch" class="countdown" slot="append" value="0"></small>
                </button>
            </div>
        `);
        await tick();

        for (const slot of ['prepend', 'append']) {
            const host = root.querySelector(`#${slot}-countdown`);
            const countdown = host.querySelector('[x-is="countdown:launch"]');
            const digit = countdown.firstElementChild;

            for (const value of ['1', '2']) {
                const incoming = document.createElement('button');
                incoming.id = `${slot}-countdown`;
                incoming.setAttribute('x-is', 'button');
                incoming.innerHTML = `
                    ${slot === 'prepend' ? `<small x-is="countdown:launch" class="countdown" slot="prepend" value="${value}"></small>` : ''}
                    ${slot === 'prepend' ? 'Prepend' : 'Append'}
                    ${slot === 'append' ? `<small x-is="countdown:launch" class="countdown" slot="append" value="${value}"></small>` : ''}
                `;

                expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
                await tick();

                expect(host.querySelector('[x-is="countdown:launch"]')).toBe(countdown);
                expect(countdown.firstElementChild).toBe(digit);
                expect(digit.style.getPropertyValue('--value')).toBe(value);
                expect(countdown.hasAttribute('slot')).toBe(false);
            }
        }
    });
});

describe('Alpine host and component namespaces', () => {
    it('rejects removed, conflicting, and composition-breaking declarations', () => {
        class AttachableButton extends Component { static attachable = true; }
        Isas.components.register('test-attachable-button', AttachableButton);
        const rejects = (html, message) => {
            document.body.innerHTML = html;
            expect(() => Alpine.initTree(document.body)).toThrow(message);
            Alpine.destroyTree(document.body);
            document.body.replaceChildren();
        };

        rejects(
            '<button x-is.headless="button"></button>',
            "x-is does not support modifier '.headless'",
        );
        rejects(
            '<button x-is.scoped.unscoped="button"></button>',
            "cannot use both '.scoped' and '.unscoped'",
        );
        rejects(
            '<button x-is="test-attachable-button" x-as="test-attachable-button"></button>',
            'cannot be both x-is and x-as',
        );
    });

    it('exposes default, explicit, dollar-prefixed, and fallback namespaces', async () => {
        const root = mount(`
            <div>
                <button id="default" x-is="button" count="2"><span x-text="$button.count"></span></button>
                <button id="explicit" x-is="button:action" enabled><span x-text="action.enabled"></span></button>
                <i id="dollar" x-is="unknown:$custom" label="ok"><span x-text="$custom.label"></span></i>
                <section id="fallback" x-is="notice-card" value="7"><span x-text="$noticeCard.value"></span></section>
            </div>
        `);
        await tick();

        expect(root.querySelector('#default').textContent).toBe('2');
        expect(root.querySelector('#explicit').textContent).toBe('true');
        expect(root.querySelector('#dollar').textContent).toBe('ok');
        expect(root.querySelector('#fallback').textContent).toBe('7');
    });

    it('coerces ordinary attributes and ignores authoring metadata', async () => {
        const host = mount(`
            <button x-is="button" count="3" enabled payload='{"ok":true}'
                class="ignored" icon:class="also-ignored" wire:click="save">
                <span id="values" x-text="JSON.stringify([$button.count, $button.enabled, $button.payload.ok])"></span>
                <span id="ignored" x-text="String('class' in $button) + ':' + String('icon:class' in $button)"></span>
            </button>
        `);
        await tick();

        expect(host.querySelector('#values').textContent).toBe('[3,true,true]');
        expect(host.querySelector('#ignored').textContent).toBe('false:false');

        host.removeAttribute('count');
        await tick();
        expect('count' in Alpine.$data(host).$button).toBe(false);
    });

    it('keeps host, primary, and attachment scopes stable and isolated', async () => {
        const events = [];
        let attachmentRenders = 0;

        class ScopeAttachment extends Component {
            static attachable = true;

            mount() {
                events.push(`mount:${this.name}:${this.slots.get('selection').text()}`);
                this.scopeState = this.reactive({ count: 1 });
            }

            identify() {
                return `${this.name}:${this.el.id}`;
            }

            mergeScope() {
                return {
                    identify: this.identify,
                    query: 'attachment-query',
                    get count() {
                        return this.scopeState.count;
                    },
                    set count(value) {
                        this.scopeState.count = Number(value);
                    },
                };
            }

            hostAttributes() { return { class: 'forbidden-attachment-class' }; }
            render() { attachmentRenders += 1; return '<b>forbidden</b>'; }
        }

        class ScopeComponent extends Component {
            mount() {
                events.push(`mount:${this.name}`);
                this.scopeState = this.reactive({ status: 'ready' });
            }

            mergeScope() {
                return {
                    el: 'replacement',
                    query: 'primary-query',
                    get status() { return this.scopeState.status; },
                    set status(value) { this.scopeState.status = String(value); },
                };
            }
        }

        Isas.components.register('test-scope-attachment', ScopeAttachment);
        Isas.components.register('test-scope', ScopeComponent);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const host = mount(`
            <section id="scope-host" x-is="test-scope:api"
                x-as="test-scope-attachment:option" query="attribute" other="one">
                <span slot="selection">Chosen</span>
                <output x-text="[$host.query, api.query, option.query, option.count, option.other].join(':')"></output>
            </section>
        `);
        await tick();

        const data = Alpine.$data(host);
        const runtime = HostRuntime.from(host);
        expect(events).toEqual(['mount:test-scope-attachment:Chosen', 'mount:test-scope']);
        expect(data.$host.el).toBe(host);
        expect(data.$host.query).toBe('attribute');
        expect(data.api.query).toBe('primary-query');
        expect(data.option.query).toBe('attachment-query');
        expect(data.option.other).toBe('one');
        expect(data.option.identify()).toBe('test-scope-attachment:scope-host');
        expect(host.querySelector('output').textContent)
            .toBe('attribute:primary-query:attachment-query:1:one');
        expect(host.classList.contains('forbidden-attachment-class')).toBe(false);
        expect(attachmentRenders).toBe(0);
        expect(runtime.componentFor('test-scope')).toBe(runtime.component);
        expect(runtime.componentFor('test-scope-attachment')).toBe(runtime.attachments.get('test-scope-attachment'));
        expect(warn).toHaveBeenCalledOnce();

        data.option.count = 2;
        data.api.status = 'updated';
        host.setAttribute('query', 'next');
        host.setAttribute('other', 'two');
        await tick();
        expect(data.$host.query).toBe('next');
        expect(data.api.query).toBe('primary-query');
        expect(data.option.query).toBe('attachment-query');
        expect(data.option.other).toBe('two');
        expect(data.option.count).toBe(2);
        expect(data.api.status).toBe('updated');

        warn.mockRestore();
    });

    it('rejects invalid mergeScope results during namespace setup', () => {
        class InvalidScopeComponent extends Component {
            mergeScope() { return null; }
        }
        Isas.components.register('test-invalid-scope', InvalidScopeComponent);

        expect(() => mount('<div x-is="test-invalid-scope"></div>'))
            .toThrow("component 'test-invalid-scope' mergeScope() must return an object.");
    });

    it('retains resolved bindings inherited by nested structural components', async () => {
        const host = mount(`
            <article x-is="article-shell:article" icon="i-tabler-components">
                <small id="local-bound" x-is="button" :icon="article.icon">Local</small>
                <div wire:id="nested-livewire">
                    <button id="island-bound" x-is="button" :icon="article.icon">Island</button>
                </div>
            </article>
        `);
        await tick();

        const local = host.querySelector('#local-bound');
        const island = host.querySelector('#island-bound');
        expect(local.querySelectorAll('.i-tabler-components')).toHaveLength(1);
        expect(island.querySelectorAll('.i-tabler-components')).toHaveLength(1);

        host.setAttribute('icon', 'i-tabler-adjustments');
        await tick();
        expect(Alpine.$data(host).article.icon).toBe('i-tabler-adjustments');
        expect(local.querySelectorAll('.i-tabler-adjustments')).toHaveLength(1);
        expect(island.querySelectorAll('.i-tabler-adjustments')).toHaveLength(1);

        const incomingHost = document.createElement('article');
        incomingHost.setAttribute('x-is', 'article-shell:article');
        incomingHost.setAttribute('icon', 'i-tabler-components');
        incomingHost.innerHTML = `
            <small id="local-bound" x-is="button" :icon="article.icon">Local</small>
            ${host.querySelector('[wire\\:id="nested-livewire"]').cloneNode(true).outerHTML}
        `;

        expect(HostRuntime.from(host).reconcileFrom(incomingHost)).toBe(true);
        await tick();
        expect(host.getAttribute('icon')).toBe('i-tabler-components');
        expect(Alpine.$data(host).article.icon).toBe('i-tabler-components');
        expect(local.getAttribute('icon')).toBe('i-tabler-components');
        expect(local.querySelectorAll('.i-tabler-components')).toHaveLength(1);
        expect(island.getAttribute('icon')).toBe('i-tabler-components');
        expect(island.querySelectorAll('.i-tabler-components')).toHaveLength(1);

        const incomingIsland = document.createElement('button');
        incomingIsland.id = 'island-bound';
        incomingIsland.setAttribute('x-is', 'button');
        incomingIsland.setAttribute(':icon', 'article.icon');
        incomingIsland.textContent = 'Island';

        expect(HostRuntime.from(island).reconcileFrom(incomingIsland)).toBe(true);
        await tick();
        expect(island.getAttribute('icon')).toBe('i-tabler-components');
        expect(island.querySelectorAll('.i-tabler-components')).toHaveLength(1);
    });

    it('uses $host for attachment-only hosts and supports all x-as forms', async () => {
        const mounted = [];
        class FirstAttachment extends Component {
            static attachable = true;
            mount() { mounted.push(['first', this.config]); }
            identify() { return this.name; }
            mergeScope() { return { identify: this.identify }; }
        }
        class SecondAttachment extends Component {
            static attachable = true;
            mount() { mounted.push(['second', this.config]); }
        }
        Isas.components.register('test-first', FirstAttachment);
        Isas.components.register('test-second', SecondAttachment);

        const root = mount(`
            <div>
                <p id="literal" x-as="test-first" value="1">
                    <span x-text="$host.value"></span>
                    <i x-text="$testFirst.identify()"></i>
                </p>
                <p id="array" x-as="['test-first', 'test-second']"></p>
                <p id="object" x-as="{ 'test-first:custom': { active: true }, testSecond: {} }"></p>
            </div>
        `);
        await tick();

        expect(root.querySelector('#literal span').textContent).toBe('1');
        expect(root.querySelector('#literal i').textContent).toBe('test-first');
        expect(Alpine.$data(root.querySelector('#literal')).$testFirst.value).toBe(1);
        expect(Alpine.$data(root.querySelector('#object')).custom).toBeDefined();
        expect(mounted.map(([name]) => name)).toEqual([
            'first', 'first', 'second', 'first', 'second',
        ]);
        expect(mounted[3][1]).toEqual({ active: true });
    });

    it('keeps $host stable when one attachment is replaced by another', async () => {
        let firstEvents = 0;
        let firstDestroyed = 0;
        const sourceSnapshots = [];
        class FirstAttachment extends Component {
            static attachable = true;
            mount() { this.listen(this.el, 'attachment-event', () => { firstEvents += 1; }); }
            destroy() { firstDestroyed += 1; }
        }
        class SecondAttachment extends Component {
            static attachable = true;
            sourceChanged() { sourceSnapshots.push(this.slots.get('selection').text()); }
        }
        Isas.components.register('test-replace-first', FirstAttachment);
        Isas.components.register('test-replace-second', SecondAttachment);

        const host = mount('<div x-as="test-replace-first" value="one"><span slot="selection">One</span></div>');
        await tick();
        const runtime = HostRuntime.from(host);
        const hostScope = Alpine.$data(host).$host;
        host.dispatchEvent(new CustomEvent('attachment-event'));
        expect(firstEvents).toBe(1);

        runtime.configureAttachments(normalizeAttachmentSpec(
            'test-replace-second',
            Isas.components,
        ));
        await tick();

        const data = Alpine.$data(host);
        expect(data.$host).toBe(hostScope);
        expect(data.$host.value).toBe('one');
        expect('$testReplaceFirst' in data).toBe(false);
        expect(data.$testReplaceSecond).toBeDefined();
        expect(firstDestroyed).toBe(1);
        host.dispatchEvent(new CustomEvent('attachment-event'));
        expect(firstEvents).toBe(1);

        const incoming = document.createElement('div');
        incoming.setAttribute('x-as', 'test-replace-second');
        incoming.setAttribute('value', 'two');
        incoming.innerHTML = '<span slot="selection">Two</span>';
        expect(runtime.adoptSource(incoming, { render: false })).toBe(true);
        expect(sourceSnapshots).toEqual(['Two']);
        expect(data.$host.value).toBe('two');
        expect(data.$testReplaceSecond.value).toBe('two');
    });

    it('finds attached component owners by component identity, not namespace', async () => {
        let resolvedOwner = null;
        class OwnerAttachment extends Component { static attachable = true; }
        class ChildAttachment extends Component {
            static attachable = true;
            mount() { resolvedOwner = this.owner('test-owner-attachment'); }
        }
        Isas.components.register('test-owner-attachment', OwnerAttachment);
        Isas.components.register('test-child-attachment', ChildAttachment);

        const host = mount(`
            <div x-as="test-owner-attachment:renamedOwner">
                <span x-as="test-child-attachment"></span>
            </div>
        `);
        await tick();

        expect(resolvedOwner).toBe(HostRuntime.from(host).componentFor('test-owner-attachment'));
        expect(Alpine.$data(host).renamedOwner).toBeDefined();
    });

    it('supports class and declaration-level scope opt-outs', async () => {
        let scopeMerges = 0;
        class BareComponent extends Component {
            static scoped = false;
            helper() { return 'merged'; }
            mergeScope() {
                scopeMerges += 1;
                return { helper: this.helper };
            }
        }
        class BareAttachment extends Component {
            static attachable = true;
            static scoped = false;
            mergeScope() { return { helper: () => 'attached' }; }
        }
        Isas.components.register('test-bare', BareComponent);
        Isas.components.register('test-bare-attachment', BareAttachment);

        const root = mount(`
            <div>
                <div id="bare" x-is="test-bare" value="x"></div>
                <div id="enhanced" x-is.scoped="test-bare" value="y">
                    <span x-text="$testBare.value + ':' + $testBare.helper()"></span>
                </div>
                <button id="unscoped" x-is.unscoped="button" value="z"></button>
                <div id="attachment" x-as.scoped="test-bare-attachment" value="a"></div>
                <div id="bare-attachment" x-as="test-bare-attachment" value="b"></div>
            </div>
        `);
        await tick();

        expect('$testBare' in Alpine.$data(root.querySelector('#bare'))).toBe(false);
        expect('$host' in Alpine.$data(root.querySelector('#bare'))).toBe(false);
        expect(root.querySelector('#enhanced').textContent.trim()).toBe('y:merged');
        expect(Alpine.$data(root.querySelector('#enhanced')).$host.value).toBe('y');
        expect('$button' in Alpine.$data(root.querySelector('#unscoped'))).toBe(false);
        expect('$host' in Alpine.$data(root.querySelector('#unscoped'))).toBe(false);
        expect(Alpine.$data(root.querySelector('#attachment')).$host.value).toBe('a');
        expect(Alpine.$data(root.querySelector('#attachment')).$testBareAttachment.helper())
            .toBe('attached');
        expect('$host' in Alpine.$data(root.querySelector('#bare-attachment'))).toBe(false);
        expect('$testBareAttachment' in Alpine.$data(root.querySelector('#bare-attachment'))).toBe(false);
        expect(scopeMerges).toBe(1);
    });
});

describe('lifecycle and reconciliation', () => {
    it('cleans runtimes and restores canonical authored children', async () => {
        const host = mount('<button x-is="button" class="explicit" color="primary" icon="icon">Label</button>');
        await tick();
        expect(HostRuntime.from(host)).not.toBeNull();
        expect(host.className).toBe('btn btn-primary explicit');

        Alpine.destroyTree(host);
        expect(HostRuntime.from(host)).toBeNull();
        expect(host.className).toBe('explicit');
        expect(host.innerHTML).toBe('Label');
    });

    it('reconciles a Livewire-style canonical response without duplicate wrappers', async () => {
        const host = mount(`
            <button x-is="button" icon="icon" prepend:class="before">
                Click <span x-is="badge" slot="append">0</span>
            </button>
        `);
        await tick();

        const template = document.createElement('template');
        template.innerHTML = `
            <button x-is="button" icon="icon" prepend:class="before">
                Click <span x-is="badge" slot="append">1</span>
            </button>
        `;

        expect(HostRuntime.from(host).reconcileFrom(template.content.firstElementChild)).toBe(true);
        await tick();
        expect(host.querySelectorAll('.before')).toHaveLength(1);
        expect(host.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
        expect(host.querySelector('[x-is="badge"]').textContent).toBe('1');
    });

    it('preserves wire:text-owned children during a local structural rerender', async () => {
        const host = mount(`
            <button x-is="button" icon="icon">
                Revision <span wire:text="revision"></span>
            </button>
        `);
        await tick();

        const revision = host.querySelector('[wire\\:text="revision"]');
        revision.textContent = '1';

        host.setAttribute('data-loading', 'true');
        await tick();

        expect(host.querySelector('[wire\\:text="revision"]')).toBe(revision);
        expect(revision.textContent).toBe('1');
        expect(host.hasAttribute('data-loading')).toBe(true);

        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.setAttribute('icon', 'icon');
        incoming.innerHTML = `
            Revision <span wire:text="revision" data-server-state="updated"></span>
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.querySelector('[wire\\:text="revision"]')).toBe(revision);
        expect(revision.textContent).toBe('1');
        expect(revision.dataset.serverState).toBe('updated');
    });

    it('reconciles an x-is runtime nested beneath a teleported wrapper', async () => {
        const root = mount(`
            <div>
                <div id="teleport-target"></div>
                <article x-is="card">
                    <template x-teleport="#teleport-target">
                        <div data-teleported-wrapper>
                            <button x-is="button" wire:click="revise">Revision 1</button>
                        </div>
                    </template>
                </article>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="card"]');
        const target = root.querySelector('#teleport-target');
        const teleported = target.querySelector('[x-is="button"]');
        const teleportedRuntime = HostRuntime.from(teleported);
        const incoming = document.createElement('article');
        incoming.setAttribute('x-is', 'card');
        incoming.innerHTML = `
            <template x-teleport="#teleport-target">
                <div data-teleported-wrapper>
                    <button x-is="button" wire:click="revise">Revision 2</button>
                </div>
            </template>
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(target.querySelectorAll('[data-teleported-wrapper]')).toHaveLength(1);
        expect(target.querySelectorAll('[x-is="button"]')).toHaveLength(1);
        expect(target.querySelector('[x-is="button"]')).toBe(teleported);
        expect(HostRuntime.from(teleported)).toBe(teleportedRuntime);
        expect(teleported.textContent.trim()).toBe('Revision 2');
        expect(teleportedRuntime.source.innerHTML()).toContain('Revision 2');
    });

    it('does not initialize x-is on Alpine Morph clone targets', async () => {
        const host = mount(`
            <button x-is="button" icon="icon" prepend:class="before">
                Click <span x-is="badge" slot="append">0</span>
            </button>
        `);
        await tick();

        const previousMorph = Alpine.morph;
        Alpine.morph = (from, to) => {
            Alpine.cloneNode(from, to);
            from.innerHTML = to.innerHTML;
        };

        try {
            for (const count of [1, 2]) {
                const incoming = document.createElement('button');
                incoming.setAttribute('x-is', 'button');
                incoming.setAttribute('icon', 'icon');
                incoming.setAttribute('prepend:class', 'before');
                incoming.innerHTML = `Click <span x-is="badge" slot="append">${count}</span>`;

                HostRuntime.from(host).reconcileFrom(incoming);
                await tick();

                expect(host.querySelectorAll('.before')).toHaveLength(1);
                expect(host.querySelectorAll('.icon')).toHaveLength(1);
                expect(host.querySelector('[x-is="badge"]').textContent).toBe(String(count));
            }
        } finally {
            Alpine.morph = previousMorph;
        }
    });

    it('preserves Alpine-owned text inside a pass-through badge after reconciliation', async () => {
        const root = mount(`
            <div x-data="{ clicks: 1 }">
                <button x-is="button" icon="icon">
                    Click <span x-is="badge" slot="append" x-text="clicks"></span>
                </button>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="button"]');
        const badge = host.querySelector('[x-is="badge"]');
        expect(badge.textContent).toBe('1');

        Alpine.$data(root).clicks = 2;
        await tick();
        expect(badge.textContent).toBe('2');

        const previousMorph = Alpine.morph;
        Alpine.morph = (from, to, options = {}) => {
            const liveBadge = from.querySelector('[x-is="badge"]');
            const targetBadge = to.querySelector('[x-is="badge"]');
            let skipBadge = false;
            let skipBadgeChildren = false;

            options.updating?.(from, to, () => {}, () => {}, () => {});
            options.updating?.(
                liveBadge,
                targetBadge,
                () => {},
                () => { skipBadge = true; },
                () => { skipBadgeChildren = true; },
            );

            if (!skipBadge && !skipBadgeChildren) liveBadge.textContent = targetBadge.textContent;
        };

        try {
            host.setAttribute('data-loading', 'true');
            await tick();
            expect(badge.textContent).toBe('2');

            const incoming = document.createElement('button');
            incoming.setAttribute('x-is', 'button');
            incoming.setAttribute('icon', 'icon');
            incoming.innerHTML = 'Click <span x-is="badge" slot="append" x-text="clicks"></span>';

            HostRuntime.from(host).reconcileFrom(incoming);
            await tick();

            expect(badge.textContent).toBe('2');
            expect(host.querySelectorAll('.icon')).toHaveLength(1);
        } finally {
            Alpine.morph = previousMorph;
        }
    });

    it('preserves wire:text-owned badge content during a local parent rerender', async () => {
        const host = mount(`
            <button x-is="button" icon="icon">
                Click <span x-is="badge" slot="append" wire:text="clicks"></span>
            </button>
        `);
        await tick();

        const badge = host.querySelector('[x-is="badge"]');
        badge.textContent = '4';

        const previousMorph = Alpine.morph;
        Alpine.morph = (from, to, options = {}) => {
            const targetBadge = to.querySelector('[x-is="badge"]');
            let skipBadge = false;
            let skipBadgeChildren = false;
            options.updating?.(
                badge,
                targetBadge,
                () => {},
                () => { skipBadge = true; },
                () => { skipBadgeChildren = true; },
            );
            if (!skipBadge && !skipBadgeChildren) badge.textContent = targetBadge.textContent;
        };

        try {
            host.setAttribute('data-loading', 'true');
            await tick();
            expect(badge.textContent).toBe('4');
        } finally {
            Alpine.morph = previousMorph;
        }
    });

    it('preserves a nested Livewire component when the parent target contains its cloned island', async () => {
        const host = mount(`
            <article x-is="button" icon="i-tabler-components">
                <div wire:id="nested-counter" wire:key="nested-counter-demo">
                    <span data-count>4</span>
                    <button x-is="button" icon="i-tabler-plus" wire:click="increment">
                        Increment child
                        <span x-is="badge" slot="append" wire:text="count">4</span>
                    </button>
                </div>
            </article>
        `);
        await tick();

        const child = host.querySelector('[wire\\:id="nested-counter"]');
        const childButton = child.querySelector('[wire\\:click="increment"]');
        const childRuntime = HostRuntime.from(childButton);
        const canonicalChildSource = childRuntime.source.outerHTML();

        for (const revision of [1, 2]) {
            const incoming = document.createElement('article');
            incoming.setAttribute('x-is', 'button');
            incoming.setAttribute('icon', 'i-tabler-components');
            incoming.innerHTML = `
                ${child.cloneNode(true).outerHTML}
                <span slot="append" data-parent-revision>${revision}</span>
            `;

            expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
            await tick();

            const preserved = host.querySelector('[wire\\:id="nested-counter"]');
            expect(preserved).toBe(child);
            expect(preserved.querySelector('[data-count]').textContent).toBe('4');
            expect(preserved.querySelector('[wire\\:click="increment"]')).toBe(childButton);
            expect(childRuntime.source.outerHTML()).toBe(canonicalChildSource);
            expect(childButton.querySelectorAll('.i-tabler-plus')).toHaveLength(1);
            expect(childButton.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
            expect(host.querySelector('[data-parent-revision]').textContent).toBe(String(revision));
            expect(host.querySelectorAll('.i-tabler-components')).toHaveLength(1);
        }
    });

    it('reconciles the first x-isas boundary owned by a nested Livewire component', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const host = mount(`
            <article x-is="livewire-shell">
                <div wire:id="nested-counter">
                    <button x-is="button" icon="i-tabler-plus" wire:click="increment">
                        Increment child
                        <span x-is="badge" slot="append" wire:text="count">0</span>
                    </button>
                </div>
            </article>
        `);
        await tick();

        const componentRoot = host.querySelector('[wire\\:id="nested-counter"]');
        const childButton = componentRoot.querySelector('[wire\\:click="increment"]');

        for (let request = 0; request < 2; request += 1) {
            const incoming = document.createElement('button');
            incoming.setAttribute('x-is', 'button');
            incoming.setAttribute('icon', 'i-tabler-plus');
            incoming.setAttribute('wire:click', 'increment');
            incoming.innerHTML = `
                Increment child
                <span x-is="badge" slot="append" wire:text="count"></span>
            `;
            let skipped = false;

            morphUpdating({
                el: childButton,
                toEl: incoming,
                component: { el: componentRoot },
                skip: () => { skipped = true; },
            });
            await tick();

            expect(skipped).toBe(true);
            expect(childButton.querySelectorAll('.i-tabler-plus')).toHaveLength(1);
            expect(childButton.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
            expect(childButton.querySelector('[x-is="badge"]').hasAttribute('slot')).toBe(false);
        }

        delete globalThis.Livewire;
    });

    it('intercepts the outermost Livewire morph boundary', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const host = mount('<button x-is="button">Count <span x-is="badge" slot="append">0</span></button>');
        await tick();
        const incoming = document.createElement('button');
        incoming.setAttribute('x-is', 'button');
        incoming.innerHTML = 'Count <span x-is="badge" slot="append">2</span>';
        let skipped = false;

        morphUpdating({ el: host, toEl: incoming, skip: () => { skipped = true; } });
        await tick();

        expect(skipped).toBe(true);
        expect(host.querySelector('[x-is="badge"]').textContent).toBe('2');
        delete globalThis.Livewire;
    });
});
