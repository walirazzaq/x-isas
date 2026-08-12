import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Isas,
    Steps,
    stepsAdapter,
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
    delete globalThis.Livewire;
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('steps presentation', () => {
    it('registers Steps without a standalone Step component', () => {
        expect(Isas.components.get('steps')).toBe(Steps);
        expect(Isas.adapters.get('steps')).toBe(stepsAdapter);
        expect(Isas.components.has('step')).toBe(false);
        expect(Isas.adapters.has('step')).toBe(false);
    });

    it('maps direction while preserving authored classes and unmarked children', async () => {
        const host = mount(`
            <ol x-is="steps" direction="vertical"
                class="lg:steps-horizontal authored-steps">
                <li data-unmarked>Introduction</li>
                <li x-part="step">Account</li>
            </ol>
        `);
        const unmarked = host.querySelector('[data-unmarked]');
        await tick();

        expect(host.className)
            .toBe('steps steps-vertical lg:steps-horizontal authored-steps');
        expect(host.querySelector('[data-unmarked]')).toBe(unmarked);
        expect(unmarked.classList.contains('step')).toBe(false);
        expect(host.querySelector('[x-part="step"]').classList.contains('step')).toBe(true);
    });

    it('reacts to direction changes without stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ direction: 'vertical' }">
                <ol x-is="steps" :direction="direction" class="authored">
                    <li x-part="step">Account</li>
                </ol>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="steps"]');
        expect(host.className).toBe('steps steps-vertical authored');

        Alpine.$data(root).direction = 'horizontal';
        await tick();
        expect(host.className).toBe('steps steps-horizontal authored');

        Alpine.$data(root).direction = 'diagonal';
        await tick();
        expect(host.className).toBe('steps authored');
    });

    it('maps every supported per-step color and ignores unknown colors', async () => {
        const colors = [
            'neutral',
            'primary',
            'secondary',
            'accent',
            'info',
            'success',
            'warning',
            'error',
        ];
        const host = mount(`
            <ol x-is="steps">
                ${colors.map((color) => (
                    `<li x-part="step" color="${color}">${color}</li>`
                )).join('')}
                <li x-part="step" color="unknown">unknown</li>
            </ol>
        `);
        await tick();

        const steps = host.querySelectorAll(':scope > [x-part="step"]');
        colors.forEach((color, index) => {
            expect(steps[index].classList.contains(`step-${color}`)).toBe(true);
        });
        expect(steps[colors.length].className).toBe('step');
    });

    it('applies parent step defaults and lets local attributes win', async () => {
        const host = mount(`
            <ol x-is="steps" step:color="primary" step:class="parent-step"
                step:label:class="parent-label">
                <li id="inherited" x-part="step" label="Inherited"></li>
                <li id="local" x-part="step" color="error" label="Local"
                    class="local-step" label:class="local-label"></li>
            </ol>
        `);
        await tick();

        const inherited = host.querySelector('#inherited');
        const local = host.querySelector('#local');
        expect(inherited.className).toBe('step step-primary parent-step');
        expect(inherited.querySelector(':scope > span').className)
            .toBe('min-w-0 parent-label');
        expect(local.className).toBe('step step-error parent-step local-step');
        expect(local.querySelector(':scope > span').className)
            .toBe('min-w-0 parent-label local-label');
    });

    it('preserves raw DaisyUI marker markup and native data-content', async () => {
        const host = mount(`
            <ol x-is="steps">
                <li id="symbol" x-part="step" data-content="!">Review</li>
                <li id="raw" x-part="step">
                    <span class="step-icon" data-raw-icon>🚀</span>
                    <strong>Launch</strong>
                </li>
            </ol>
        `);
        await tick();

        const symbol = host.querySelector('#symbol');
        const raw = host.querySelector('#raw');
        expect(symbol.getAttribute('data-content')).toBe('!');
        expect(symbol.childElementCount).toBe(0);
        expect(symbol.textContent).toBe('Review');
        expect(raw.querySelector(':scope > .step-icon[data-raw-icon]')).not.toBeNull();
        expect(raw.querySelector(':scope > strong').textContent).toBe('Launch');
        expect(raw.querySelector(':scope > .min-w-0')).toBeNull();
    });

    it('composes icon shorthand and authored content into marker and label regions', async () => {
        const host = mount(`
            <ol x-is="steps">
                <li x-part="step" icon="i-tabler-check" icon:class="text-lg"
                    label:class="font-medium">Completed <em>profile</em></li>
            </ol>
        `);
        await tick();

        const step = host.querySelector('[x-part="step"]');
        expect(step.children).toHaveLength(2);
        expect(step.children[0].classList.contains('step-icon')).toBe(true);
        expect(step.children[0].classList.contains('i-tabler-check')).toBe(false);
        expect(step.children[0].firstElementChild.classList.contains('i-tabler-check'))
            .toBe(true);
        expect(step.children[0].firstElementChild.classList.contains('text-lg')).toBe(true);
        expect(step.children[1].className).toBe('min-w-0 font-medium');
        expect(step.children[1].textContent.trim()).toBe('Completed profile');
        expect(step.children[1].querySelector('em')).not.toBeNull();
    });

    it('uses an icon slot instead of the shorthand and preserves arbitrary markup', async () => {
        const host = mount(`
            <ol x-is="steps">
                <li x-part="step" icon="i-tabler-ignored" data-content="!"
                    icon:data-marker="custom">
                    Confirm
                    <span slot="icon"><strong data-custom-icon>★</strong></span>
                </li>
            </ol>
        `);
        await tick();

        const marker = host.querySelector('.step-icon');
        const icon = marker.firstElementChild;
        expect(marker.getAttribute('data-marker')).toBeNull();
        expect(icon.getAttribute('data-marker')).toBe('custom');
        expect(marker.classList.contains('i-tabler-ignored')).toBe(false);
        expect(icon.classList.contains('i-tabler-ignored')).toBe(false);
        expect(icon.querySelector('[data-custom-icon]').textContent).toBe('★');
        expect(host.querySelectorAll('.step-icon')).toHaveLength(1);
        expect(host.querySelector('[x-part="step"]').getAttribute('data-content')).toBe('!');
    });

    it('uses escaped label fallback while authored default markup wins', async () => {
        const host = mount(`
            <ol x-is="steps">
                <li id="fallback" x-part="step"
                    label="&lt;img src=x onerror=alert(1)&gt;"></li>
                <li id="authored" x-part="step" label="Ignored"
                    icon="i-tabler-star">Authored <em>label</em></li>
            </ol>
        `);
        await tick();

        expect(host.querySelector('#fallback img')).toBeNull();
        expect(host.querySelector('#fallback').textContent)
            .toBe('<img src=x onerror=alert(1)>');
        expect(host.querySelector('#authored').textContent).toContain('Authored label');
        expect(host.querySelector('#authored').textContent).not.toContain('Ignored');
        expect(host.querySelector('#authored em')).not.toBeNull();
    });

    it('requires step parts to use li hosts', () => {
        expect(() => mount(`
            <ol x-is="steps"><div x-part="step">Invalid</div></ol>
        `)).toThrow("requires x-part='step' to use a <li> element");
    });

    it('reacts to bound step presentation and composition attributes', async () => {
        const root = mount(`
            <div x-data="{ color: 'primary', icon: null, label: 'Choose' }">
                <ol x-is="steps">
                    <li x-part="step" :color="color" :icon="icon" :label="label"></li>
                </ol>
            </div>
        `);
        await tick();

        const step = root.querySelector('[x-part="step"]');
        expect(step.classList.contains('step-primary')).toBe(true);
        expect(step.querySelector('.step-icon')).toBeNull();
        expect(step.textContent).toBe('Choose');

        Alpine.$data(root).color = 'success';
        Alpine.$data(root).icon = 'i-tabler-check';
        Alpine.$data(root).label = 'Complete';
        await tick();

        expect(step.classList.contains('step-primary')).toBe(false);
        expect(step.classList.contains('step-success')).toBe(true);
        expect(step.querySelector('.step-icon > .i-tabler-check')).not.toBeNull();
        expect(step.textContent).toBe('Complete');
    });

    it('reconciles keyed steps, composition changes, order, and nested icon content', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const componentRoot = mount(`
            <div wire:id="steps-parts-demo">
                <ol x-is="steps">
                    <li x-part="step" wire:key="account">Account</li>
                    <li x-part="step" wire:key="plan" color="primary">
                        Plan
                        <span slot="icon"><span x-is="badge" size="xs">2</span></span>
                    </li>
                </ol>
            </div>
        `);
        await tick();

        const host = componentRoot.querySelector('[x-is="steps"]');
        const plan = host.querySelector('[wire\\:key="plan"]');
        const badge = plan.querySelector('[x-is="badge"]');
        const incoming = document.createElement('ol');
        incoming.setAttribute('x-is', 'steps');
        incoming.setAttribute('direction', 'vertical');
        incoming.innerHTML = `
            <li x-part="step" wire:key="plan" color="success">
                Plan selected
                <span slot="icon"><span x-is="badge" size="xs">3</span></span>
            </li>
            <li x-part="step" wire:key="account" color="success"
                icon="i-tabler-check" aria-current="step">Account complete</li>
        `;

        let skipped = false;
        morphUpdating({
            el: host,
            toEl: incoming,
            component: { el: componentRoot },
            skip: () => { skipped = true; },
        });
        await tick();

        const steps = host.querySelectorAll(':scope > [x-part="step"]');
        expect(skipped).toBe(true);
        expect(steps).toHaveLength(2);
        expect(steps[0]).toBe(plan);
        expect(steps[1].getAttribute('wire:key')).toBe('account');
        expect(plan.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('3');
        expect(plan.textContent).toContain('Plan selected');
        expect(steps[1].querySelector('.i-tabler-check')).not.toBeNull();
        expect(steps[1].textContent).toContain('Account complete');
        expect(steps[1].getAttribute('aria-current')).toBe('step');
        expect(host.classList.contains('steps-vertical')).toBe(true);
    });

    it('restores the canonical authored tree on teardown', async () => {
        const host = mount(`
            <ol x-is="steps" direction="vertical">
                <li x-part="step" color="success" icon="i-tabler-check">Account</li>
            </ol>
        `);
        await tick();
        expect(host.querySelector('.step-icon')).not.toBeNull();

        Alpine.destroyTree(host);

        expect(host.className).toBe('');
        expect(host.firstElementChild.className).toBe('');
        expect(host.firstElementChild.textContent).toBe('Account');
        expect(host.firstElementChild.getAttribute('icon')).toBe('i-tabler-check');
    });
});
