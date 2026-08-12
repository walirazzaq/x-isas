import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, {
    badgeAdapter,
    HostRuntime,
    Isas,
    TabContent,
    TabPanels,
    Tabs,
    tabsAdapter,
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
    vi.restoreAllMocks();
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('tabs', () => {
    it('registers the functional components and DaisyUI adapter', () => {
        expect(Isas.components.get('tabs')).toBe(Tabs);
        expect(Isas.components.get('tab-panels')).toBe(TabPanels);
        expect(Isas.components.get('tab-content')).toBe(TabContent);
        expect(Isas.adapters.get('tabs')).toBe(tabsAdapter);
        expect(Isas.adapters.has('tab-panels')).toBe(false);
        expect(Isas.adapters.has('tab-content')).toBe(false);
    });

    it('keeps panel-less anchors and radio tabs presentation-only', async () => {
        const host = mount(`
            <div x-is="tabs" variant="border" placement="bottom" size="lg">
                <a x-part="tab" href="/one"><strong>One</strong><span data-raw>!</span></a>
                <a x-part="tab" href="/two" active>Two</a>
                <input x-part="tab" type="radio" name="native-tabs" aria-label="Three">
                <input x-part="tab" type="radio" name="native-tabs" aria-label="Four" checked>
            </div>
        `);
        await tick();

        expect([...host.classList]).toEqual(expect.arrayContaining([
            'tabs', 'tabs-border', 'tabs-bottom', 'tabs-lg',
        ]));
        expect(host.hasAttribute('role')).toBe(false);
        expect(host.hasAttribute('data-isas-tabs-managed')).toBe(false);
        const tabs = host.querySelectorAll('[x-part="tab"]');
        expect(tabs[1].classList).toContain('tab-active');
        expect(tabs[0].hasAttribute('aria-selected')).toBe(false);
        expect(tabs[0].innerHTML).toBe('<strong>One</strong><span data-raw="">!</span>');
        expect(tabs[2].getAttribute('name')).toBe('native-tabs');
        expect(tabs[3].getAttribute('name')).toBe('native-tabs');
        expect(tabs[3].checked).toBe(true);
    });

    it('composes tab icons and badges in order without changing managed interaction', async () => {
        const host = mount(`
            <div x-is="tabs" value="overview"
                tab:prepend:class="parent-prepend" tab:icon:title="Parent icon">
                <button x-part="tab" name="overview"
                    icon="i-tabler-home" icon:class="local-icon" icon:title="Local icon"
                    badge="&lt;New&gt;" badge:color="info"
                    icon-end="i-tabler-arrow-right" icon-end:aria-hidden="true"
                    badge-end="4" badge-end:variant="soft">Overview</button>
                <section x-part="tab-content" name="overview">Overview panel</section>
                <button x-part="tab" name="activity" icon="i-tabler-activity">Activity</button>
                <section x-part="tab-content" name="activity">Activity panel</section>
            </div>
        `);
        await tick();

        const [overview, activity] = host.querySelectorAll('[x-part="tab"]');
        const [prepend, append] = overview.children;
        const [icon, badge] = prepend.children;
        const [iconEnd, badgeEnd] = append.children;

        expect([...prepend.classList]).toEqual(expect.arrayContaining([
            'inline-flex', 'me-2', 'parent-prepend',
        ]));
        expect(append.classList).toContain('ms-2');
        expect([...icon.classList]).toEqual(expect.arrayContaining([
            'i-tabler-home', 'local-icon', 'shrink-0',
        ]));
        expect(icon.getAttribute('title')).toBe('Local icon');
        expect(badge.matches('[x-is="badge"]')).toBe(true);
        expect(badge.getAttribute('size')).toBe('sm');
        expect([...badge.classList]).toEqual(expect.arrayContaining(['badge', 'badge-sm', 'badge-info']));
        expect(badge.textContent).toBe('<New>');
        expect([...overview.childNodes].map((node) => node.nodeType === Node.TEXT_NODE
            ? node.textContent.trim()
            : node === prepend ? 'prepend' : 'append').filter(Boolean))
            .toEqual(['prepend', 'Overview', 'append']);
        expect([...iconEnd.classList]).toEqual(expect.arrayContaining([
            'i-tabler-arrow-right', 'shrink-0',
        ]));
        expect(iconEnd.getAttribute('aria-hidden')).toBe('true');
        expect(badgeEnd.textContent).toBe('4');

        activity.querySelector('.i-tabler-activity').dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        }));
        await tick();
        expect(host.value).toBe('activity');
        expect(activity.getAttribute('aria-selected')).toBe('true');
    });

    it('supports accessories on passive links and lets authored side slots override shorthands', async () => {
        const host = mount(`
            <div x-is="tabs">
                <a x-part="tab" href="/docs" icon="i-tabler-book" badge-end="2">Docs</a>
                <button x-part="tab" icon="ignored-icon" badge="Ignored"
                    icon-end="retained-end" badge-end="7"
                    prepend:class="custom-prepend">
                    <strong slot="prepend" data-custom-prepend>Custom</strong>
                    Prepend override
                </button>
                <button x-part="tab" icon="retained-icon" badge="1"
                    icon-end="ignored-end" badge-end="Ignored"
                    append:class="custom-append">
                    Append override
                    <em slot="append" data-custom-append>End</em>
                </button>
            </div>
        `);
        await tick();

        const [link, prependOverride, appendOverride] = host.querySelectorAll('[x-part="tab"]');
        expect(link.getAttribute('href')).toBe('/docs');
        expect(link.hasAttribute('role')).toBe(false);
        expect(link.hasAttribute('aria-selected')).toBe(false);
        expect(link.querySelector('.i-tabler-book')).not.toBeNull();
        expect(link.querySelector('[x-is="badge"]').textContent).toBe('2');

        expect(prependOverride.querySelector('[data-custom-prepend]')).not.toBeNull();
        expect(prependOverride.querySelector('.custom-prepend')).not.toBeNull();
        expect(prependOverride.querySelector('.ignored-icon')).toBeNull();
        expect(prependOverride.querySelector('.retained-end')).not.toBeNull();
        expect(prependOverride.querySelector('[x-is="badge"]').textContent).toBe('7');

        expect(appendOverride.querySelector('[data-custom-append]')).not.toBeNull();
        expect(appendOverride.querySelector('.custom-append')).not.toBeNull();
        expect(appendOverride.querySelector('.retained-icon')).not.toBeNull();
        expect(appendOverride.querySelector('.ignored-end')).toBeNull();
        expect(appendOverride.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
        expect(appendOverride.querySelector('[x-is="badge"]').textContent).toBe('1');
    });

    it('uses the registered Badge adapter and retains generated badge identity through morphs', async () => {
        Isas.adapters.register('badge', () => ({
            host: { class: 'replacement-badge' },
        }), { replace: true });

        try {
            const host = mount(`
                <div x-is="tabs">
                    <a x-part="tab" wire:key="inbox" href="/inbox" badge-end="3">Inbox</a>
                </div>
            `);
            await tick();

            const runtime = HostRuntime.from(host);
            const tab = host.querySelector('[x-part="tab"]');
            const badge = tab.querySelector('[x-is="badge"]');
            expect(badge.classList).toContain('replacement-badge');
            expect(runtime.source.outerHTML()).not.toContain('data-isas-generated');

            tab.setAttribute('badge-end', '4');
            await tick();
            expect(tab.querySelector('[x-is="badge"]')).toBe(badge);
            expect(badge.textContent).toBe('4');

            const incoming = document.createElement('div');
            incoming.setAttribute('x-is', 'tabs');
            incoming.innerHTML = `
                <a x-part="tab" wire:key="inbox" href="/inbox" badge-end="5">Inbox</a>
            `;
            expect(runtime.reconcileFrom(incoming)).toBe(true);
            await tick();

            expect(tab.querySelector('[x-is="badge"]')).toBe(badge);
            expect(badge.textContent).toBe('5');
            expect(HostRuntime.from(badge).source.innerHTML()).toBe('5');

            const plain = document.createElement('div');
            plain.setAttribute('x-is', 'tabs');
            plain.innerHTML = '<a x-part="tab" wire:key="inbox" href="/inbox">Inbox</a>';
            expect(runtime.reconcileFrom(plain)).toBe(true);
            await tick();

            expect(tab.querySelector('[x-is="badge"]')).toBeNull();
            expect(HostRuntime.from(badge)).toBeNull();
            expect(tab.textContent).toBe('Inbox');
            expect(tab.querySelector('[data-isas-generated]')).toBeNull();
        } finally {
            Isas.adapters.register('badge', badgeAdapter, { replace: true });
        }
    });

    it('rejects accessory attributes on void tab hosts without affecting plain radios', async () => {
        const host = mount(`
            <div x-is="tabs">
                <input x-part="tab" type="radio" name="native" aria-label="Native">
            </div>
        `);
        await tick();
        expect(host.querySelector('input').getAttribute('name')).toBe('native');

        Alpine.destroyTree(document.body);
        document.body.replaceChildren();
        expect(() => mount(`
            <div x-is="tabs">
                <input x-part="tab" type="radio" name="native" icon="i-tabler-home">
            </div>
        `)).toThrow(/tab accessories require a non-void/);
    });

    it('manages adjacent named panels, ARIA, events, and direction state', async () => {
        const host = mount(`
            <div x-is="tabs" value="overview" aria-label="Account">
                <button x-part="tab" name="overview">Overview</button>
                <section x-part="tab-content" name="overview">Overview panel</section>
                <button x-part="tab" name="security">Security</button>
                <section x-part="tab-content" name="security">Security panel</section>
            </div>
        `);
        const change = vi.fn();
        host.addEventListener('tabchange', change);
        await tick();

        const [overview, security] = host.querySelectorAll('[x-part="tab"]');
        const [overviewPanel, securityPanel] = host.querySelectorAll('[x-part="tab-content"]');
        expect(host.getAttribute('role')).toBe('tablist');
        expect(overview.getAttribute('aria-selected')).toBe('true');
        expect(overview.getAttribute('type')).toBe('button');
        expect(overview.getAttribute('tabindex')).toBe('0');
        expect(security.getAttribute('tabindex')).toBe('-1');
        expect(overview.getAttribute('aria-controls')).toBe(overviewPanel.id);
        expect(overviewPanel.getAttribute('aria-labelledby')).toBe(overview.id);
        expect(overviewPanel.hidden).toBe(false);
        expect(securityPanel.hidden).toBe(true);

        security.click();
        await tick();
        expect(host.value).toBe('security');
        expect(security.getAttribute('aria-selected')).toBe('true');
        expect(securityPanel.hidden).toBe(false);
        expect(overviewPanel.hidden).toBe(true);
        expect(overview.getAttribute('data-isas-tab-state')).toBe('previous');
        expect(overview.getAttribute('data-isas-tab-position')).toBe('before');
        expect(Alpine.$data(host).$tabs.direction).toBe('next');
        expect(change).toHaveBeenCalledTimes(1);
        expect(change.mock.calls[0][0].detail).toMatchObject({
            value: 'security',
            previousValue: 'overview',
            index: 1,
            previousIndex: 0,
            direction: 'next',
        });
    });

    it('allows unnamed adjacent pairs when there is no model', async () => {
        const host = mount(`
            <div x-is="tabs">
                <button x-part="tab">One</button>
                <section x-part="tab-content">First</section>
                <button x-part="tab">Two</button>
                <section x-part="tab-content">Second</section>
            </div>
        `);
        await tick();

        const tabs = host.querySelectorAll('[x-part="tab"]');
        const panels = host.querySelectorAll('[x-part="tab-content"]');
        expect(tabs[0].getAttribute('aria-selected')).toBe('true');
        tabs[1].click();
        await tick();
        expect(panels[0].hidden).toBe(true);
        expect(panels[1].hidden).toBe(false);
    });

    it('synchronizes scalar x-model and supports the shared selection methods', async () => {
        const root = mount(`
            <div x-data="{ section: 'security' }">
                <div x-is="tabs" x-model="section">
                    <button x-part="tab" name="overview">Overview</button>
                    <section x-part="tab-content" name="overview">Overview</section>
                    <button x-part="tab" name="security">Security</button>
                    <section x-part="tab-content" name="security">Security</section>
                </div>
            </div>
        `);
        await tick();
        const host = root.querySelector('[x-is="tabs"]');
        const scope = Alpine.$data(host).$tabs;
        expect(scope.value).toBe('security');

        scope.first();
        await tick();
        expect(Alpine.$data(root).section).toBe('overview');
        expect(scope.previousValue).toBe('security');

        Alpine.$data(root).section = 'security';
        await tick();
        expect(scope.value).toBe('security');
        expect(scope.position('overview')).toBe('before');
    });

    it('supports automatic and manual keyboard activation with disabled skipping', async () => {
        const host = mount(`
            <div x-is="tabs" activation="manual">
                <button x-part="tab" name="one">One</button>
                <section x-part="tab-content" name="one">One</section>
                <button x-part="tab" name="two" disabled>Two</button>
                <section x-part="tab-content" name="two">Two</section>
                <button x-part="tab" name="three">Three</button>
                <section x-part="tab-content" name="three">Three</section>
            </div>
        `);
        await tick();
        const tabs = host.querySelectorAll('[x-part="tab"]');
        tabs[0].focus();
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', bubbles: true, cancelable: true,
        }));
        await tick();
        expect(document.activeElement).toBe(tabs[2]);
        expect(host.value).toBe('one');

        tabs[2].dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', bubbles: true, cancelable: true,
        }));
        await tick();
        expect(host.value).toBe('three');

        host.setAttribute('activation', 'automatic');
        await tick();
        tabs[2].dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', bubbles: true, cancelable: true,
        }));
        await tick();
        expect(host.value).toBe('one');
        expect(Alpine.$data(host).$tabs.direction).toBe('next');
    });

    it('links multiple structural panel hosts and exposes a shared proxy API', async () => {
        const root = mount(`
            <div>
                <div x-is="tabs" id="account-tabs" value="overview">
                    <button x-part="tab" name="overview">Overview</button>
                    <button x-part="tab" name="security">Security</button>
                </div>
                <main x-is="tab-panels" controlled-by-tabs="account-tabs">
                    <section x-part="tab-content" name="overview">Main overview</section>
                    <section x-part="tab-content" name="security">Main security</section>
                </main>
                <aside x-is="tab-panels" controlled-by-tabs="account-tabs">
                    <section x-part="tab-content" name="overview">Aside overview</section>
                    <section x-part="tab-content" name="security">Aside security</section>
                </aside>
            </div>
        `);
        await tick();
        const tabsHost = root.querySelector('[x-is="tabs"]');
        const panelHosts = root.querySelectorAll('[x-is="tab-panels"]');
        const tabs = tabsHost.querySelectorAll('[x-part="tab"]');
        const overviewPanels = root.querySelectorAll('[x-part="tab-content"][name="overview"]');
        const securityPanels = root.querySelectorAll('[x-part="tab-content"][name="security"]');

        expect(tabs[0].getAttribute('aria-controls').split(' ')).toEqual([
            overviewPanels[0].id,
            overviewPanels[1].id,
        ]);
        expect([...overviewPanels].every((panel) => !panel.hidden)).toBe(true);
        expect([...securityPanels].every((panel) => panel.hidden)).toBe(true);
        expect(Alpine.$data(panelHosts[0]).$tabPanels.tabs).toBe(tabsHost);

        Alpine.$data(panelHosts[1]).$tabPanels.select('security');
        await tick();
        expect([...overviewPanels].every((panel) => panel.hidden)).toBe(true);
        expect([...securityPanels].every((panel) => !panel.hidden)).toBe(true);
    });

    it('supports an attached panels host with functional tab-content children', async () => {
        const root = mount(`
            <div>
                <div x-is="tabs" id="detached-tabs">
                    <button x-part="tab" name="alpha">Alpha</button>
                    <button x-part="tab" name="bravo">Bravo</button>
                </div>
                <main x-as="tab-panels" controlled-by-tabs="detached-tabs">
                    <section x-as="tab-content" name="alpha">Alpha content</section>
                    <section x-as="tab-content" name="bravo">Bravo content</section>
                </main>
            </div>
        `);
        await tick();
        const tabs = root.querySelectorAll('[x-part="tab"]');
        const contents = root.querySelectorAll('[x-as="tab-content"]');
        expect(contents[0].getAttribute('role')).toBe('tabpanel');
        expect(Alpine.$data(contents[0]).$tabContent.active).toBe(true);
        expect(Alpine.$data(contents[1]).$tabContent.position).toBe('after');

        tabs[1].click();
        await tick();
        expect(contents[0].hidden).toBe(true);
        expect(contents[1].hidden).toBe(false);
        expect(Alpine.$data(contents[0]).$tabContent.previous).toBe(true);
    });

    it('implicitly attaches tab-panels to another primary component', async () => {
        const root = mount(`
            <div>
                <div x-is="tabs" id="implicit-tabs">
                    <button x-part="tab" name="alpha">Alpha</button>
                    <button x-part="tab" name="bravo">Bravo</button>
                </div>
                <article x-is="card" controlled-by-tabs="implicit-tabs">
                    <section x-as="tab-content" name="alpha">Alpha content</section>
                    <section x-as="tab-content" name="bravo">Bravo content</section>
                </article>
            </div>
        `);
        await tick();
        const card = root.querySelector('[x-is="card"]');
        const panels = card.querySelectorAll('[x-as="tab-content"]');
        expect(Alpine.$data(card).$tabPanels.linked).toBe(true);
        expect(panels[0].hidden).toBe(false);
        expect(panels[1].hidden).toBe(true);
    });

    it('uses vertical arrows and falls forward when the active tab is disabled', async () => {
        const host = mount(`
            <div x-is="tabs" aria-orientation="vertical" value="one">
                <button x-part="tab" name="one">One</button>
                <section x-part="tab-content" name="one">One</section>
                <button x-part="tab" name="two">Two</button>
                <section x-part="tab-content" name="two">Two</section>
            </div>
        `);
        await tick();
        const tabs = host.querySelectorAll('[x-part="tab"]');
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', bubbles: true, cancelable: true,
        }));
        await tick();
        expect(host.value).toBe('two');

        tabs[1].setAttribute('disabled', '');
        await tick();
        expect(host.value).toBe('one');
        expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    });

    it('reactively relinks a bound tab-panels host', async () => {
        const root = mount(`
            <div x-data="{ target: 'first-tabs' }">
                <div x-is="tabs" id="first-tabs" value="alpha">
                    <button x-part="tab" name="alpha">Alpha</button>
                    <button x-part="tab" name="bravo">Bravo</button>
                </div>
                <div x-is="tabs" id="second-tabs" value="bravo">
                    <button x-part="tab" name="alpha">Alpha</button>
                    <button x-part="tab" name="bravo">Bravo</button>
                </div>
                <main x-is="tab-panels" :controlled-by-tabs="target">
                    <section x-part="tab-content" name="alpha">Alpha</section>
                    <section x-part="tab-content" name="bravo">Bravo</section>
                </main>
            </div>
        `);
        await tick();
        const panels = root.querySelectorAll('[x-part="tab-content"]');
        expect(panels[0].hidden).toBe(false);

        Alpine.$data(root).target = 'second-tabs';
        await tick();
        expect(panels[0].hidden).toBe(true);
        expect(panels[1].hidden).toBe(false);
    });

    it('leaves hidden ownership to consumers in manual visibility mode', async () => {
        const root = mount(`
            <div>
                <div x-is="tabs" id="manual-tabs">
                    <button x-part="tab" name="alpha">Alpha</button>
                    <button x-part="tab" name="bravo">Bravo</button>
                </div>
                <main x-is="tab-panels" controlled-by-tabs="manual-tabs" visibility="manual">
                    <section x-part="tab-content" name="alpha">Alpha</section>
                    <section x-part="tab-content" name="bravo">Bravo</section>
                </main>
            </div>
        `);
        await tick();
        const panels = root.querySelectorAll('[x-part="tab-content"]');
        expect(panels[0].hasAttribute('hidden')).toBe(false);
        expect(panels[1].hasAttribute('hidden')).toBe(false);
        expect(panels[1].getAttribute('aria-hidden')).toBe('true');
        expect(panels[1].getAttribute('data-isas-tab-position')).toBe('after');
    });

    it('supports a panel host that exists before its controlling tabs', async () => {
        const host = mount(`
            <main x-is="tab-panels" controlled-by-tabs="late-tabs">
                <section x-part="tab-content" name="one">One</section>
            </main>
        `);
        await tick();
        expect(Alpine.$data(host).$tabPanels.linked).toBe(false);

        const tabs = document.createElement('div');
        tabs.setAttribute('x-is', 'tabs');
        tabs.id = 'late-tabs';
        tabs.innerHTML = '<button x-part="tab" name="one">One</button>';
        document.body.append(tabs);
        Alpine.initTree(tabs);
        await tick();

        expect(Alpine.$data(host).$tabPanels.linked).toBe(true);
        expect(host.querySelector('[x-part="tab-content"]').hidden).toBe(false);
    });

    it('rejects malformed local pairs and managed radio tabs', async () => {
        expect(() => mount(`
            <div x-is="tabs">
                <section x-part="tab-content">Orphan</section>
            </div>
        `)).toThrow(/immediately follow/);
        Alpine.destroyTree(document.body);
        document.body.replaceChildren();

        expect(() => mount(`
            <div x-is="tabs">
                <input x-part="tab" type="radio" name="one">
                <section x-part="tab-content" name="one">One</section>
            </div>
        `)).toThrow(/does not support radio inputs/);
    });
});
