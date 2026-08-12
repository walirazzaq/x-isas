import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    AttributeBag,
    HostRuntime,
    radialProgressAdapter,
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

describe('progress', () => {
    it('renders labeled wrapper progress with a generated native bar', async () => {
        const host = mount(`
            <div x-is="progress" value="45" max="100" size="sm" color="primary"
                label="Uploading" description="45 files completed"
                class="authored-shell" bar:class="rounded-box"
                bar:aria-label="Upload completion"></div>
        `);
        await tick();

        const bar = host.querySelector(':scope > progress[data-isas-progress-bar]');
        expect(host.className).toBe('flex flex-col gap-1 authored-shell');
        expect(bar).not.toBeNull();
        expect(bar.className).toBe('progress progress-primary h-2 rounded-box');
        expect(bar.value).toBe(45);
        expect(bar.max).toBe(100);
        expect(bar.getAttribute('aria-label')).toBe('Upload completion');
        expect(host.querySelector(':scope > div').textContent).toContain('Uploading');
        expect(host.querySelector(':scope > div').textContent).toContain('45%');
        expect(host.lastElementChild.textContent).toBe('45 files completed');
        expect(host.lastElementChild.className)
            .toBe('text-sm leading-tight text-base-content/70');
    });

    it('prefers named slots over content attributes', async () => {
        const host = mount(`
            <div x-is="progress" value="72" label="Attribute label"
                label-end="Attribute end" description="Attribute description">
                <strong slot="label">Slot label</strong>
                <small slot="label-end">72 / 100</small>
                <em slot="description">Slot description</em>
            </div>
        `);
        await tick();

        expect(host.textContent).toContain('Slot label');
        expect(host.textContent).toContain('72 / 100');
        expect(host.textContent).toContain('Slot description');
        expect(host.textContent).not.toContain('Attribute label');
        expect(host.textContent).not.toContain('Attribute end');
        expect(host.textContent).not.toContain('Attribute description');
    });

    it('supports one authored progress bar and gives shell values precedence', async () => {
        const host = mount(`
            <section x-is="progress" value="25" max="50" bar:data-track="release">
                <progress x-part="bar" value="8" max="10" class="authored-bar"></progress>
            </section>
        `);
        await tick();

        const bar = host.querySelector('progress');
        expect(bar.value).toBe(25);
        expect(bar.max).toBe(50);
        expect(bar.dataset.track).toBe('release');
        expect(bar.classList.contains('authored-bar')).toBe(true);
        expect(host.textContent).toContain('50%');
    });

    it('uses authored bar values when shell values are absent', async () => {
        const host = mount(`
            <div x-is="progress">
                <progress x-part="bar" value="3" max="8"></progress>
            </div>
        `);
        await tick();

        const bar = host.querySelector('progress');
        expect(bar.value).toBe(3);
        expect(bar.max).toBe(8);
        expect(host.textContent).toContain('38%');
    });

    it('keeps missing values indeterminate and suppresses the automatic percentage', async () => {
        const host = mount('<div x-is="progress" label="Waiting"></div>');
        await tick();

        const bar = host.querySelector('progress');
        expect(bar.hasAttribute('value')).toBe(false);
        expect(bar.hasAttribute('max')).toBe(false);
        expect(host.textContent).toBe('Waiting');
    });

    it('defaults determinate max, clamps display percentages, and normalizes invalid values', async () => {
        const high = mount('<div x-is="progress" value="150"></div>');
        await tick();
        expect(high.querySelector('progress').getAttribute('max')).toBe('100');
        expect(high.querySelector('progress').getAttribute('value')).toBe('150');
        expect(high.textContent).toBe('100%');

        Alpine.destroyTree(high);
        const invalid = mount('<div x-is="progress" value="invalid" max="0"></div>');
        await tick();
        expect(invalid.querySelector('progress').getAttribute('value')).toBe('0');
        expect(invalid.querySelector('progress').getAttribute('max')).toBe('0');
        expect(invalid.textContent).toBe('0%');
    });

    it('supports a native progress host without label composition', async () => {
        const host = mount(`
            <progress x-is="progress" value="6" max="10" size="xl" color="success"
                label="Not rendered" class="authored-native"></progress>
        `);
        await tick();

        expect(host.children).toHaveLength(0);
        expect(host.className)
            .toBe('progress progress-success h-5 authored-native');
        expect(host.value).toBe(6);
        expect(host.max).toBe(10);
        expect(host.textContent).not.toContain('Not rendered');
    });

    it('reacts on a native progress host without generating children', async () => {
        const root = mount(`
            <div x-data="{ value: 2, color: 'primary', size: 'xs' }">
                <progress x-is="progress" :value="value" max="10"
                    :color="color" :size="size" class="authored-native"></progress>
            </div>
        `);
        await tick();

        const host = root.querySelector('progress');
        expect(host.value).toBe(2);
        expect(host.classList.contains('progress-primary')).toBe(true);
        expect(host.classList.contains('h-1')).toBe(true);

        Alpine.$data(root).value = 7;
        Alpine.$data(root).color = 'info';
        Alpine.$data(root).size = 'lg';
        await tick();

        expect(host.children).toHaveLength(0);
        expect(host.value).toBe(7);
        expect(host.classList.contains('progress-primary')).toBe(false);
        expect(host.classList.contains('progress-info')).toBe(true);
        expect(host.classList.contains('h-1')).toBe(false);
        expect(host.classList.contains('h-4')).toBe(true);
        expect(host.classList.contains('authored-native')).toBe(true);
    });

    it.each([
        [
            `<div x-is="progress">
                <progress x-part="bar"></progress>
                <progress x-part="bar"></progress>
            </div>`,
            "allows only one x-part='bar'",
        ],
        [
            `<div x-is="progress"><div x-part="bar"></div></div>`,
            "requires x-part='bar' to use a <progress> element",
        ],
    ])('rejects invalid authored bar markup', (html, message) => {
        expect(() => mount(html)).toThrow(message);
    });

    it('reacts to value and presentation changes without stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ value: 20, color: 'primary', size: 'xs' }">
                <div x-is="progress" :value="value" :color="color" :size="size"
                    class="authored-shell" bar:class="authored-bar"></div>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="progress"]');
        let bar = host.querySelector('progress');
        expect(bar.classList.contains('progress-primary')).toBe(true);
        expect(bar.classList.contains('h-1')).toBe(true);
        expect(host.textContent).toContain('20%');

        Alpine.$data(root).value = 80;
        Alpine.$data(root).color = 'warning';
        Alpine.$data(root).size = 'lg';
        await tick();

        bar = host.querySelector('progress');
        expect(bar.value).toBe(80);
        expect(bar.classList.contains('progress-primary')).toBe(false);
        expect(bar.classList.contains('progress-warning')).toBe(true);
        expect(bar.classList.contains('h-1')).toBe(false);
        expect(bar.classList.contains('h-4')).toBe(true);
        expect(bar.classList.contains('authored-bar')).toBe(true);
        expect(host.classList.contains('authored-shell')).toBe(true);
        expect(host.textContent).toContain('80%');
        expect(HostRuntime.from(host).source.attributes.get('class')).toBe('authored-shell');
    });
});

describe('radial progress', () => {
    it('renders defaults with normalized ARIA and DaisyUI variables', async () => {
        const host = mount('<div x-is="radial-progress"></div>');
        await tick();

        expect(host.className).toBe('radial-progress text-primary');
        expect(host.textContent).toBe('0%');
        expect(host.getAttribute('role')).toBe('progressbar');
        expect(host.getAttribute('aria-valuenow')).toBe('0');
        expect(host.getAttribute('aria-valuemin')).toBe('0');
        expect(host.getAttribute('aria-valuemax')).toBe('100');
        expect(host.style.getPropertyValue('--value')).toBe('0');
        expect(host.style.getPropertyValue('--size')).toBe('5rem');
        expect(host.style.getPropertyValue('--thickness'))
            .toBe('max(1px, calc(5rem * 0.1))');
    });

    it('supports custom content and suppresses only generated percentage text', async () => {
        const custom = mount(`
            <div x-is="radial-progress" value="72" show-value="false">
                <strong>72 / 100</strong>
            </div>
        `);
        await tick();
        expect(custom.textContent.trim()).toBe('72 / 100');

        Alpine.destroyTree(custom);
        const hidden = mount(
            '<div x-is="radial-progress" value="72" show-value="false"></div>',
        );
        await tick();
        expect(hidden.textContent).toBe('');
    });

    it('supports custom dimensions and background palette precedence', async () => {
        const host = mount(`
            <div x-is="radial-progress" value="3" max="4" size="8rem"
                thickness="0.65rem" color="warning" background="accent"
                class="authored" style="margin-top: 2px"></div>
        `);
        await tick();

        expect(host.textContent).toBe('75%');
        expect(host.classList.contains('bg-accent')).toBe(true);
        expect(host.classList.contains('text-accent-content')).toBe(true);
        expect(host.classList.contains('text-warning')).toBe(false);
        expect(host.classList.contains('authored')).toBe(true);
        expect(host.style.getPropertyValue('--size')).toBe('8rem');
        expect(host.style.getPropertyValue('--thickness')).toBe('0.65rem');
        expect(host.classList.contains('border')).toBe(true);
        expect(host.style.getPropertyValue('margin-top')).toBe('2px');

        const adapted = radialProgressAdapter({
            attrs: AttributeBag.from({
                value: '3',
                max: '4',
                size: '8rem',
                thickness: '0.65rem',
                background: 'accent',
            }),
        });
        expect(adapted.host.style)
            .toContain('border-width: max(1px, calc(0.65rem * 0.5))');
    });

    it('clamps percentages and falls back from invalid numeric values', async () => {
        const high = mount('<div x-is="radial-progress" value="150" max="100"></div>');
        await tick();
        expect(high.textContent).toBe('100%');
        expect(high.getAttribute('aria-valuenow')).toBe('100');

        Alpine.destroyTree(high);
        const invalid = mount('<div x-is="radial-progress" value="invalid" max="0"></div>');
        await tick();
        expect(invalid.textContent).toBe('0%');
        expect(invalid.getAttribute('aria-valuenow')).toBe('0');
    });

    it('reactively replaces palette and managed styles while preserving authored values', async () => {
        const root = mount(`
            <div x-data="{ value: 25, color: 'primary', background: '', size: 'sm' }">
                <div x-is="radial-progress" :value="value" :color="color"
                    :background="background" :size="size"
                    class="authored" style="margin-left: 3px"></div>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="radial-progress"]');
        expect(host.classList.contains('text-primary')).toBe(true);
        expect(host.style.getPropertyValue('--size')).toBe('4rem');

        Alpine.$data(root).value = 90;
        Alpine.$data(root).color = 'warning';
        Alpine.$data(root).background = 'error';
        Alpine.$data(root).size = 'xl';
        await tick();

        expect(host.textContent).toBe('90%');
        expect(host.classList.contains('text-primary')).toBe(false);
        expect(host.classList.contains('text-warning')).toBe(false);
        expect(host.classList.contains('bg-error')).toBe(true);
        expect(host.classList.contains('text-error-content')).toBe(true);
        expect(host.classList.contains('authored')).toBe(true);
        expect(host.style.getPropertyValue('--value')).toBe('90');
        expect(host.style.getPropertyValue('--size')).toBe('7rem');
        expect(host.style.getPropertyValue('--thickness')).toBe('0.6rem');
        expect(host.style.getPropertyValue('margin-left')).toBe('3px');
    });
});
