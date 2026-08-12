import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Isas,
    Timeline,
    timelineAdapter,
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

function directConnectors(item) {
    return [...item.children].filter((child) => child.localName === 'hr');
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

describe('timeline presentation', () => {
    it('registers Timeline without a standalone TimelineItem component', () => {
        expect(Isas.components.get('timeline')).toBe(Timeline);
        expect(Isas.adapters.get('timeline')).toBe(timelineAdapter);
        expect(Isas.components.has('timeline-item')).toBe(false);
        expect(Isas.components.has('item')).toBe(false);
        expect(Isas.adapters.has('timeline-item')).toBe(false);
    });

    it('maps direction, compact, and snap-icon while preserving authored classes', async () => {
        const host = mount(`
            <ul x-is="timeline" direction="vertical" compact snap-icon
                class="md:timeline-horizontal authored"></ul>
        `);
        await tick();

        expect(host.className).toBe(
            'timeline timeline-vertical timeline-compact timeline-snap-icon md:timeline-horizontal authored',
        );
    });

    it('uses the base layout for missing and unknown directions', async () => {
        const root = mount(`
            <div>
                <ul x-is="timeline"></ul>
                <ul x-is="timeline" direction="horizontal"></ul>
                <ul x-is="timeline" direction="diagonal"></ul>
            </div>
        `);
        await tick();

        const timelines = root.querySelectorAll('[x-is="timeline"]');
        expect(timelines[0].className).toBe('timeline');
        expect(timelines[1].className).toBe('timeline timeline-horizontal');
        expect(timelines[2].className).toBe('timeline');
    });

    it('reacts to host modifier changes without stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ direction: 'vertical', compact: true, snap: false }">
                <ul x-is="timeline" :direction="direction" :compact="compact"
                    :snap-icon="snap" class="authored"></ul>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="timeline"]');
        expect(host.className).toBe('timeline timeline-vertical timeline-compact authored');

        Alpine.$data(root).direction = 'horizontal';
        Alpine.$data(root).compact = false;
        Alpine.$data(root).snap = true;
        await tick();

        expect(host.className).toBe('timeline timeline-horizontal timeline-snap-icon authored');

        Alpine.$data(root).direction = 'unknown';
        Alpine.$data(root).snap = false;
        await tick();
        expect(host.className).toBe('timeline authored');
    });

    it('requires item parts to be direct li elements', () => {
        expect(() => mount(`
            <ul x-is="timeline"><div x-part="item">Invalid</div></ul>
        `)).toThrow("requires x-part='item' to use a <li> element");
    });

    it('preserves unmarked children and ordered item hosts', async () => {
        const host = mount(`
            <ul x-is="timeline">
                <li data-unmarked>Unmarked</li>
                <li x-part="item" start="One">First</li>
                <li data-separator>Separator</li>
                <li x-part="item" start="Two">Second</li>
            </ul>
        `);
        const authored = [...host.children];
        await tick();

        expect([...host.children]).toEqual(authored);
        expect([...host.children].map((child) => child.textContent.trim()))
            .toEqual(['Unmarked', 'OneFirst', 'Separator', 'TwoSecond']);
        expect(host.querySelector('[data-unmarked]').className).toBe('');
        expect(host.querySelector('[data-separator]').className).toBe('');
    });

    it('preserves exact raw DaisyUI regions and connectors', async () => {
        const host = mount(`
            <ul x-is="timeline">
                <li x-part="item" data-raw>
                    <hr data-before class="bg-primary">
                    <div class="timeline-start" data-start><time>1984</time></div>
                    <div class="timeline-middle" data-middle><span>●</span></div>
                    <div class="timeline-end timeline-box" data-end><strong>Macintosh</strong></div>
                    <hr data-after class="bg-secondary">
                </li>
            </ul>
        `);
        const item = host.querySelector('[data-raw]');
        const children = [...item.children];
        await tick();

        expect([...item.children]).toEqual(children);
        expect([...item.children].map((child) => child.localName))
            .toEqual(['hr', 'div', 'div', 'div', 'hr']);
        expect(item.querySelector('[data-start]').className).toBe('timeline-start');
        expect(item.querySelector('[data-middle]').className).toBe('timeline-middle');
        expect(item.querySelector('[data-end]').className).toBe('timeline-end timeline-box');
        expect(item.querySelector('[data-before]').className).toBe('bg-primary');
        expect(item.querySelector('[data-after]').className).toBe('bg-secondary');
    });

    it('composes attributes, default end content, a nested icon, and box placement', async () => {
        const host = mount(`
            <ul x-is="timeline">
                <li x-part="item" start="1984" icon="i-tabler-check" box="end">
                    First <strong>Macintosh</strong>
                </li>
            </ul>
        `);
        await tick();

        const item = host.querySelector('[x-part="item"]');
        expect([...item.children].map((child) => child.className))
            .toEqual(['timeline-start', 'timeline-middle', 'timeline-end timeline-box']);
        expect(item.querySelector('.timeline-start').textContent).toBe('1984');
        expect(item.querySelector('.timeline-middle > .i-tabler-check')).not.toBeNull();
        expect(item.querySelector('.timeline-middle').classList.contains('i-tabler-check'))
            .toBe(false);
        expect(item.querySelector('.timeline-end').textContent.trim()).toBe('First Macintosh');
        expect(item.querySelector('.timeline-end strong')).not.toBeNull();
        expect(directConnectors(item)).toHaveLength(0);
    });

    it('uses named slots over attributes and explicit attributes over default content', async () => {
        const host = mount(`
            <ul x-is="timeline">
                <li x-part="item" start="Attribute start" middle="Attribute middle"
                    end="Attribute end" icon="i-tabler-ignored">
                    Ignored default
                    <article slot="start"><strong>Slotted start</strong></article>
                    <span slot="middle"><em>Slotted middle</em></span>
                    <section slot="end"><b>Slotted end</b></section>
                </li>
                <li x-part="item" start="Start" end="Explicit end">Ignored fallback</li>
            </ul>
        `);
        await tick();

        const items = host.querySelectorAll('[x-part="item"]');
        expect(items[0].querySelector('.timeline-start').textContent).toBe('Slotted start');
        expect(items[0].querySelector('.timeline-middle').textContent).toBe('Slotted middle');
        expect(items[0].querySelector('.timeline-end').textContent).toBe('Slotted end');
        expect(items[0].textContent).not.toContain('Attribute');
        expect(items[0].textContent).not.toContain('Ignored default');
        expect(items[0].querySelector('.i-tabler-ignored')).toBeNull();
        expect(items[1].querySelector('.timeline-end').textContent).toBe('Explicit end');
        expect(items[1].textContent).not.toContain('Ignored fallback');
    });

    it('escapes attribute content and omits empty regions', async () => {
        const host = mount(`
            <ul x-is="timeline">
                <li x-part="item" start="&lt;img src=x onerror=alert(1)&gt;"
                    middle="&lt;strong&gt;Middle&lt;/strong&gt;"
                    end="&lt;em&gt;End&lt;/em&gt;"></li>
                <li x-part="item" start="" icon="" box="none">Only end</li>
            </ul>
        `);
        await tick();

        const items = host.querySelectorAll('[x-part="item"]');
        expect(items[0].querySelector('img')).toBeNull();
        expect(items[0].querySelector('strong')).toBeNull();
        expect(items[0].querySelector('em')).toBeNull();
        expect(items[0].querySelector('.timeline-start').textContent)
            .toBe('<img src=x onerror=alert(1)>');
        expect(items[0].querySelector('.timeline-middle').textContent)
            .toBe('<strong>Middle</strong>');
        expect(items[0].querySelector('.timeline-end').textContent).toBe('<em>End</em>');
        expect(items[1].querySelector('.timeline-start')).toBeNull();
        expect(items[1].querySelector('.timeline-middle')).toBeNull();
        expect(items[1].querySelector('.timeline-end').textContent).toBe('Only end');
        expect(items[1].querySelector('.timeline-box')).toBeNull();
    });

    it('maps every box placement and ignores unknown values', async () => {
        const host = mount(`
            <ul x-is="timeline">
                ${['start', 'end', 'both', 'none', 'unknown'].map((box) => `
                    <li x-part="item" start="Start" end="End" box="${box}"></li>
                `).join('')}
            </ul>
        `);
        await tick();

        const items = host.querySelectorAll('[x-part="item"]');
        expect(items[0].querySelector('.timeline-start').classList.contains('timeline-box')).toBe(true);
        expect(items[0].querySelector('.timeline-end').classList.contains('timeline-box')).toBe(false);
        expect(items[1].querySelector('.timeline-start').classList.contains('timeline-box')).toBe(false);
        expect(items[1].querySelector('.timeline-end').classList.contains('timeline-box')).toBe(true);
        expect(items[2].querySelectorAll('.timeline-box')).toHaveLength(2);
        expect(items[3].querySelector('.timeline-box')).toBeNull();
        expect(items[4].querySelector('.timeline-box')).toBeNull();
    });

    it('forwards every region namespace and applies parent defaults with local precedence', async () => {
        const host = mount(`
            <ul x-is="timeline" item:start="Parent start" item:box="end"
                item:connector="both" item:before:class="parent-before"
                item:start:class="parent-start" item:middle:class="parent-middle"
                item:icon:class="parent-icon" item:end:class="parent-end"
                item:after:class="parent-after">
                <li id="inherited" x-part="item" icon="i-tabler-check">Inherited end</li>
                <li id="local" x-part="item" start="Local start" box="start"
                    connector="none" icon="i-tabler-star" icon:class="local-icon"
                    end:class="local-end">Local end</li>
            </ul>
        `);
        await tick();

        const inherited = host.querySelector('#inherited');
        const local = host.querySelector('#local');
        expect(inherited.firstElementChild.localName).toBe('hr');
        expect(inherited.firstElementChild.className).toBe('parent-before');
        expect(inherited.lastElementChild.className).toBe('parent-after');
        expect(inherited.querySelector('.timeline-start').classList.contains('parent-start')).toBe(true);
        expect(inherited.querySelector('.timeline-middle').classList.contains('parent-middle')).toBe(true);
        expect(inherited.querySelector('.i-tabler-check').classList.contains('parent-icon')).toBe(true);
        expect(inherited.querySelector('.timeline-end').className)
            .toBe('timeline-end timeline-box parent-end');
        expect(local.querySelector('.timeline-start').textContent).toBe('Local start');
        expect(local.querySelector('.timeline-start').classList.contains('timeline-box')).toBe(true);
        expect(local.querySelector('.timeline-end').className)
            .toBe('timeline-end parent-end local-end');
        expect(local.querySelector('.i-tabler-star').className)
            .toBe('i-tabler-star parent-icon local-icon');
        expect(directConnectors(local)).toHaveLength(0);
    });

    it('generates automatic connectors for one, two, and multiple items', async () => {
        const root = mount(`
            <div>
                <ul id="one" x-is="timeline">
                    <li x-part="item" end="One"></li>
                </ul>
                <ul id="two" x-is="timeline">
                    <li x-part="item" end="One"></li>
                    <li x-part="item" end="Two"></li>
                </ul>
                <ul id="three" x-is="timeline">
                    <li x-part="item" end="One"></li>
                    <li x-part="item" end="Two"></li>
                    <li x-part="item" end="Three"></li>
                </ul>
            </div>
        `);
        await tick();

        expect(directConnectors(root.querySelector('#one li'))).toHaveLength(0);
        const two = root.querySelectorAll('#two li');
        expect(directConnectors(two[0])).toHaveLength(1);
        expect(two[0].lastElementChild.localName).toBe('hr');
        expect(directConnectors(two[1])).toHaveLength(1);
        expect(two[1].firstElementChild.localName).toBe('hr');
        const three = root.querySelectorAll('#three li');
        expect(directConnectors(three[0])).toHaveLength(1);
        expect(directConnectors(three[1])).toHaveLength(2);
        expect(directConnectors(three[2])).toHaveLength(1);
        expect(three[1].firstElementChild.localName).toBe('hr');
        expect(three[1].lastElementChild.localName).toBe('hr');
    });

    it('supports every connector override and treats unknown values as auto', async () => {
        const host = mount(`
            <ul x-is="timeline">
                <li x-part="item" end="Before" connector="before" before:data-side="before"></li>
                <li x-part="item" end="After" connector="after" after:data-side="after"></li>
                <li x-part="item" end="Both" connector="both"></li>
                <li x-part="item" end="None" connector="none"></li>
                <li x-part="item" end="Unknown" connector="invalid"></li>
            </ul>
        `);
        await tick();

        const items = host.querySelectorAll('[x-part="item"]');
        expect(directConnectors(items[0])).toHaveLength(1);
        expect(items[0].firstElementChild.getAttribute('data-side')).toBe('before');
        expect(directConnectors(items[1])).toHaveLength(1);
        expect(items[1].lastElementChild.getAttribute('data-side')).toBe('after');
        expect(directConnectors(items[2])).toHaveLength(2);
        expect(directConnectors(items[3])).toHaveLength(0);
        expect(directConnectors(items[4])).toHaveLength(1);
        expect(items[4].firstElementChild.localName).toBe('hr');
        expect(items[4].querySelector('hr').outerHTML).not.toContain('</hr>');
    });

    it('reacts to item composition, box, and connector changes', async () => {
        const root = mount(`
            <div x-data="{ box: 'end', connector: 'none', icon: 'i-tabler-check' }">
                <ul x-is="timeline">
                    <li x-part="item" start="Now" :box="box" :connector="connector"
                        :icon="icon">Reactive</li>
                    <li x-part="item" end="Next"></li>
                </ul>
            </div>
        `);
        await tick();

        const item = root.querySelector('[x-part="item"]');
        expect(item.querySelector('.timeline-end').classList.contains('timeline-box')).toBe(true);
        expect(item.querySelector('.i-tabler-check')).not.toBeNull();
        expect(directConnectors(item)).toHaveLength(0);

        Alpine.$data(root).box = 'start';
        Alpine.$data(root).connector = 'after';
        Alpine.$data(root).icon = 'i-tabler-star';
        await tick();

        expect(root.querySelector('[x-part="item"]')).toBe(item);
        expect(item.querySelector('.timeline-start').classList.contains('timeline-box')).toBe(true);
        expect(item.querySelector('.timeline-end').classList.contains('timeline-box')).toBe(false);
        expect(item.querySelector('.i-tabler-check')).toBeNull();
        expect(item.querySelector('.i-tabler-star')).not.toBeNull();
        expect(directConnectors(item)).toHaveLength(1);
        expect(item.lastElementChild.localName).toBe('hr');
    });

    it('reconciles keyed order, raw-to-composed changes, connectors, and nested middle identity', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const componentRoot = mount(`
            <div wire:id="timeline-parts-demo">
                <ul x-is="timeline" direction="horizontal">
                    <li x-part="item" wire:key="raw">
                        <div class="timeline-end">Raw item</div><hr>
                    </li>
                    <li x-part="item" wire:key="rich" start="2025" box="end">
                        Rich item
                        <span slot="middle"><span x-is="badge" size="xs">2</span></span>
                    </li>
                </ul>
            </div>
        `);
        await tick();

        const host = componentRoot.querySelector('[x-is="timeline"]');
        const rich = host.querySelector('[wire\\:key="rich"]');
        const badge = rich.querySelector('[x-is="badge"]');
        const incoming = document.createElement('ul');
        incoming.setAttribute('x-is', 'timeline');
        incoming.setAttribute('direction', 'vertical');
        incoming.setAttribute('compact', '');
        incoming.innerHTML = `
            <li x-part="item" wire:key="rich" start="2025" box="start">
                Rich updated
                <span slot="middle"><span x-is="badge" size="xs">4</span></span>
            </li>
            <li x-part="item" wire:key="raw" start="2024" icon="i-tabler-check">Now composed</li>
        `;

        let skipped = false;
        morphUpdating({
            el: host,
            toEl: incoming,
            component: { el: componentRoot },
            skip: () => { skipped = true; },
        });
        await tick();

        const items = host.querySelectorAll(':scope > [x-part="item"]');
        expect(skipped).toBe(true);
        expect(items).toHaveLength(2);
        expect(items[0]).toBe(rich);
        expect(rich.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('4');
        expect(rich.querySelector('.timeline-start').classList.contains('timeline-box')).toBe(true);
        expect(rich.textContent).toContain('Rich updated');
        expect(rich.firstElementChild.classList.contains('timeline-start')).toBe(true);
        expect(rich.lastElementChild.localName).toBe('hr');
        expect(directConnectors(items[1])).toHaveLength(1);
        expect(items[1].firstElementChild.localName).toBe('hr');
        expect(items[1].lastElementChild.localName).not.toBe('hr');
        expect(items[1].querySelector('.i-tabler-check')).not.toBeNull();
        expect(host.classList.contains('timeline-vertical')).toBe(true);
        expect(host.classList.contains('timeline-compact')).toBe(true);
    });

    it('restores the canonical authored tree on teardown', async () => {
        const host = mount(`
            <ul x-is="timeline" direction="vertical" compact class="authored">
                <li x-part="item" start="1984" icon="i-tabler-check" box="end">Macintosh</li>
            </ul>
        `);
        await tick();
        expect(host.querySelector('.timeline-middle')).not.toBeNull();

        Alpine.destroyTree(host);

        expect(host.className).toBe('authored');
        expect(host.firstElementChild.className).toBe('');
        expect(host.firstElementChild.childElementCount).toBe(0);
        expect(host.firstElementChild.textContent).toBe('Macintosh');
        expect(host.firstElementChild.getAttribute('start')).toBe('1984');
        expect(host.firstElementChild.getAttribute('icon')).toBe('i-tabler-check');
        expect(host.firstElementChild.getAttribute('box')).toBe('end');
    });
});
