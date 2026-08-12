import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Isas,
    Stats,
    statsAdapter,
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

describe('stats presentation', () => {
    it('registers Stats without a standalone Stat component', () => {
        expect(Isas.components.get('stats')).toBe(Stats);
        expect(Isas.adapters.get('stats')).toBe(statsAdapter);
        expect(Isas.components.has('stat')).toBe(false);
        expect(Isas.components.has('stats-item')).toBe(false);
        expect(Isas.adapters.has('stat')).toBe(false);
    });

    it('maps explicit directions and leaves missing or unknown values at the base layout', async () => {
        const root = mount(`
            <div>
                <div x-is="stats" direction="vertical"></div>
                <div x-is="stats" direction="horizontal"></div>
                <div x-is="stats"></div>
                <div x-is="stats" direction="diagonal"></div>
            </div>
        `);
        await tick();

        const stats = root.querySelectorAll('[x-is="stats"]');
        expect(stats[0].className).toBe('stats stats-vertical');
        expect(stats[1].className).toBe('stats stats-horizontal');
        expect(stats[2].className).toBe('stats');
        expect(stats[3].className).toBe('stats');
    });

    it('reacts to direction changes without leaving stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ direction: 'vertical' }">
                <div x-is="stats" :direction="direction"
                    class="lg:stats-horizontal authored"></div>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="stats"]');
        expect(host.className).toBe('stats stats-vertical lg:stats-horizontal authored');

        Alpine.$data(root).direction = 'horizontal';
        await tick();
        expect(host.className).toBe('stats stats-horizontal lg:stats-horizontal authored');

        Alpine.$data(root).direction = 'unknown';
        await tick();
        expect(host.className).toBe('stats lg:stats-horizontal authored');
    });

    it('preserves arbitrary stat tags, unmarked children, and source order', async () => {
        const host = mount(`
            <div x-is="stats">
                <p data-unmarked>Summary</p>
                <section x-part="stat" heading="Downloads">31K</section>
                <article data-separator>Details</article>
                <aside x-part="stat" value="4,200"></aside>
            </div>
        `);
        const authored = [...host.children];
        await tick();

        expect([...host.children]).toEqual(authored);
        expect([...host.children].map((child) => child.localName))
            .toEqual(['p', 'section', 'article', 'aside']);
        expect(host.querySelector('[data-unmarked]').className).toBe('');
        expect(host.querySelector('[data-separator]').className).toBe('');
        expect(host.querySelectorAll(':scope > .stat')).toHaveLength(2);
    });

    it('preserves exact raw DaisyUI regions and their authored order', async () => {
        const host = mount(`
            <div x-is="stats">
                <section x-part="stat" data-raw>
                    <div class="stat-value" data-value><strong>86%</strong></div>
                    <div class="stat-title" data-title>Tasks done</div>
                    <div class="stat-figure" data-figure><span>✓</span></div>
                    <div class="stat-desc" data-description>31 remaining</div>
                    <div class="stat-actions" data-actions><button>Review</button></div>
                </section>
            </div>
        `);
        const stat = host.querySelector('[data-raw]');
        const children = [...stat.children];
        await tick();

        expect([...stat.children]).toEqual(children);
        expect([...stat.children].map((child) => [...child.attributes]
            .find((attribute) => attribute.name.startsWith('data-'))?.name))
            .toEqual([
                'data-value',
                'data-title',
                'data-figure',
                'data-description',
                'data-actions',
            ]);
        expect(stat.className).toBe('stat');
        expect(stat.querySelectorAll('.stat-value')).toHaveLength(1);
    });

    it('generates canonical regions and keeps icon utilities inside the figure wrapper', async () => {
        const host = mount(`
            <div x-is="stats">
                <section x-part="stat" heading="Downloads"
                    description="Jan 1st – Feb 1st" icon="i-tabler-download"
                    icon:class="size-8" figure:class="text-primary">
                    31K
                    <div slot="actions"><button type="button">Details</button></div>
                </section>
            </div>
        `);
        await tick();

        const stat = host.querySelector('[x-part="stat"]');
        expect([...stat.children].map((child) => child.className)).toEqual([
            'stat-figure text-primary',
            'stat-title',
            'stat-value',
            'stat-desc',
            'stat-actions',
        ]);
        expect(stat.querySelector('.stat-figure').classList.contains('i-tabler-download'))
            .toBe(false);
        expect(stat.querySelector('.stat-figure > .i-tabler-download').className)
            .toBe('i-tabler-download size-8');
        expect(stat.querySelector('.stat-title').textContent).toBe('Downloads');
        expect(stat.querySelector('.stat-value').textContent.trim()).toBe('31K');
        expect(stat.querySelector('.stat-desc').textContent).toBe('Jan 1st – Feb 1st');
        expect(stat.querySelector('.stat-actions button').getAttribute('type')).toBe('button');
    });

    it('uses named slots, default value content, and escaped attributes in precedence order', async () => {
        const host = mount(`
            <div x-is="stats">
                <div id="slotted" x-part="stat" heading="Ignored heading"
                    value="Ignored value" description="Ignored description"
                    icon="i-tabler-ignored">
                    Ignored default
                    <span slot="figure"><strong>Rich figure</strong></span>
                    <span slot="heading"><em>Slotted heading</em></span>
                    <span slot="value"><b>Slotted value</b></span>
                    <span slot="description"><i>Slotted description</i></span>
                </div>
                <div id="default" x-part="stat" value="Ignored fallback">Rich <strong>31K</strong></div>
                <div id="attribute" x-part="stat"
                    heading="&lt;strong&gt;Heading&lt;/strong&gt;"
                    value="&lt;img src=x onerror=alert(1)&gt;"
                    description="&lt;em&gt;Description&lt;/em&gt;"></div>
            </div>
        `);
        await tick();

        const slotted = host.querySelector('#slotted');
        expect(slotted.querySelector('.stat-figure strong').textContent).toBe('Rich figure');
        expect(slotted.querySelector('.i-tabler-ignored')).toBeNull();
        expect(slotted.querySelector('.stat-title em').textContent).toBe('Slotted heading');
        expect(slotted.querySelector('.stat-value b').textContent).toBe('Slotted value');
        expect(slotted.querySelector('.stat-desc i').textContent).toBe('Slotted description');
        expect(slotted.textContent).not.toContain('Ignored');

        const fallback = host.querySelector('#default .stat-value');
        expect(fallback.textContent.trim()).toBe('Rich 31K');
        expect(fallback.querySelector('strong')).not.toBeNull();

        const attribute = host.querySelector('#attribute');
        expect(attribute.querySelector('strong')).toBeNull();
        expect(attribute.querySelector('img')).toBeNull();
        expect(attribute.querySelector('em')).toBeNull();
        expect(attribute.querySelector('.stat-title').textContent)
            .toBe('<strong>Heading</strong>');
        expect(attribute.querySelector('.stat-value').textContent)
            .toBe('<img src=x onerror=alert(1)>');
        expect(attribute.querySelector('.stat-desc').textContent)
            .toBe('<em>Description</em>');
    });

    it('omits unresolved regions and composes from region namespaces alone', async () => {
        const host = mount(`
            <div x-is="stats">
                <div id="empty" x-part="stat" heading="" value="" description="" icon=""></div>
                <div id="namespace" x-part="stat" value:class="text-secondary">42</div>
            </div>
        `);
        await tick();

        expect(host.querySelector('#empty').children).toHaveLength(0);
        expect(host.querySelector('#namespace').children).toHaveLength(1);
        expect(host.querySelector('#namespace .stat-value').className)
            .toBe('stat-value text-secondary');
        expect(host.querySelector('#namespace .stat-value').textContent).toBe('42');
    });

    it('forwards every namespace and applies parent defaults before local values', async () => {
        const host = mount(`
            <div x-is="stats" stat:class="place-items-center"
                stat:heading="Parent heading" stat:description="Parent description"
                stat:figure:class="parent-figure" stat:icon:class="parent-icon"
                stat:heading:class="parent-heading" stat:value:class="parent-value"
                stat:description:class="parent-description"
                stat:actions:class="parent-actions">
                <section id="inherited" x-part="stat" icon="i-tabler-chart" value="12">
                    <button slot="actions">Inspect</button>
                </section>
                <article id="local" x-part="stat" heading="Local heading" value="24"
                    figure:class="local-figure" icon="i-tabler-star" icon:class="local-icon"
                    heading:class="local-heading" value:class="local-value"
                    description="Local description" description:class="local-description"
                    actions:class="local-actions">
                    <button slot="actions">Open</button>
                </article>
            </div>
        `);
        await tick();

        const inherited = host.querySelector('#inherited');
        const local = host.querySelector('#local');
        expect(inherited.className).toBe('stat place-items-center');
        expect(inherited.querySelector('.stat-title').textContent).toBe('Parent heading');
        expect(inherited.querySelector('.stat-desc').textContent).toBe('Parent description');
        expect(inherited.querySelector('.stat-figure').className)
            .toBe('stat-figure parent-figure');
        expect(inherited.querySelector('.i-tabler-chart').className)
            .toBe('i-tabler-chart parent-icon');
        expect(inherited.querySelector('.stat-value').className)
            .toBe('stat-value parent-value');
        expect(inherited.querySelector('.stat-actions').className)
            .toBe('stat-actions parent-actions');

        expect(local.className).toBe('stat place-items-center');
        expect(local.querySelector('.stat-title').textContent).toBe('Local heading');
        expect(local.querySelector('.stat-title').className)
            .toBe('stat-title parent-heading local-heading');
        expect(local.querySelector('.stat-figure').className)
            .toBe('stat-figure parent-figure local-figure');
        expect(local.querySelector('.i-tabler-star').className)
            .toBe('i-tabler-star parent-icon local-icon');
        expect(local.querySelector('.stat-value').className)
            .toBe('stat-value parent-value local-value');
        expect(local.querySelector('.stat-desc').className)
            .toBe('stat-desc parent-description local-description');
        expect(local.querySelector('.stat-actions').className)
            .toBe('stat-actions parent-actions local-actions');
    });

    it('preserves title and authored accessibility without synthesizing semantics', async () => {
        const host = mount(`
            <div x-is="stats" aria-label="Account metrics">
                <section x-part="stat" title="Updated hourly" heading="Balance"
                    value="$89,400" role="group" aria-label="Current balance"></section>
                <div x-part="stat" value="12"></div>
            </div>
        `);
        await tick();

        const items = host.querySelectorAll('[x-part="stat"]');
        expect(host.getAttribute('aria-label')).toBe('Account metrics');
        expect(host.getAttribute('role')).toBeNull();
        expect(items[0].getAttribute('title')).toBe('Updated hourly');
        expect(items[0].getAttribute('role')).toBe('group');
        expect(items[0].getAttribute('aria-label')).toBe('Current balance');
        expect(items[0].querySelector('.stat-title').textContent).toBe('Balance');
        expect(items[1].hasAttribute('role')).toBe(false);
        expect(items[1].hasAttribute('aria-live')).toBe(false);
    });

    it('reacts across raw and composed modes on a stable stat host', async () => {
        const root = mount(`
            <div x-data="{ heading: null, value: null, icon: null }">
                <div x-is="stats">
                    <section x-part="stat" :heading="heading" :value="value" :icon="icon">
                        <div class="stat-value" data-raw>Raw value</div>
                    </section>
                </div>
            </div>
        `);
        await tick();

        const stat = root.querySelector('[x-part="stat"]');
        expect(stat.querySelector('[data-raw]')).not.toBeNull();

        Alpine.$data(root).heading = 'Downloads';
        Alpine.$data(root).value = '31K';
        Alpine.$data(root).icon = 'i-tabler-download';
        await tick();

        expect(root.querySelector('[x-part="stat"]')).toBe(stat);
        expect(stat.querySelector('.stat-value > [data-raw]')).not.toBeNull();
        expect(stat.querySelector('.stat-title').textContent).toBe('Downloads');
        expect(stat.querySelector('.stat-value').textContent).toBe('Raw value');
        expect(stat.querySelector('.i-tabler-download')).not.toBeNull();

        Alpine.$data(root).heading = null;
        Alpine.$data(root).value = null;
        Alpine.$data(root).icon = null;
        await tick();
        expect(stat.firstElementChild.hasAttribute('data-raw')).toBe(true);
        expect(stat.querySelectorAll('.stat-value')).toHaveLength(1);
    });

    it('reconciles keyed order, raw-to-composed changes, and nested figure identity', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const componentRoot = mount(`
            <div wire:id="stats-parts-demo">
                <div x-is="stats" direction="horizontal">
                    <div x-part="stat" wire:key="raw">
                        <div class="stat-value">Raw</div>
                    </div>
                    <section x-part="stat" wire:key="rich" heading="Messages">3
                        <span slot="figure"><span x-is="badge" size="xs">3</span></span>
                    </section>
                </div>
            </div>
        `);
        await tick();

        const host = componentRoot.querySelector('[x-is="stats"]');
        const rich = host.querySelector('[wire\\:key="rich"]');
        const badge = rich.querySelector('[x-is="badge"]');
        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'stats');
        incoming.setAttribute('direction', 'vertical');
        incoming.innerHTML = `
            <section x-part="stat" wire:key="rich" heading="Inbox" description="Unread">4
                <span slot="figure"><span x-is="badge" size="xs">4</span></span>
            </section>
            <div x-part="stat" wire:key="raw" heading="Converted" icon="i-tabler-chart">12</div>
        `;

        let skipped = false;
        morphUpdating({
            el: host,
            toEl: incoming,
            component: { el: componentRoot },
            skip: () => { skipped = true; },
        });
        await tick();

        const items = host.querySelectorAll(':scope > [x-part="stat"]');
        expect(skipped).toBe(true);
        expect(items).toHaveLength(2);
        expect(items[0]).toBe(rich);
        expect(rich.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('4');
        expect(rich.querySelector('.stat-title').textContent).toBe('Inbox');
        expect(rich.querySelector('.stat-desc').textContent).toBe('Unread');
        expect(rich.querySelector('.stat-value').textContent.trim()).toBe('4');
        expect(items[1].querySelector('.stat-title').textContent).toBe('Converted');
        expect(items[1].querySelector('.i-tabler-chart')).not.toBeNull();
        expect(host.classList.contains('stats-vertical')).toBe(true);
    });

    it('restores the canonical authored tree on teardown', async () => {
        const host = mount(`
            <div x-is="stats" direction="vertical" class="authored">
                <section x-part="stat" class="centered" heading="Downloads"
                    value="31K" icon="i-tabler-download"></section>
            </div>
        `);
        await tick();
        expect(host.querySelector('.stat-title')).not.toBeNull();

        Alpine.destroyTree(host);

        const stat = host.firstElementChild;
        expect(host.className).toBe('authored');
        expect(stat.className).toBe('centered');
        expect(stat.childElementCount).toBe(0);
        expect(stat.getAttribute('heading')).toBe('Downloads');
        expect(stat.getAttribute('value')).toBe('31K');
        expect(stat.getAttribute('icon')).toBe('i-tabler-download');
    });
});
