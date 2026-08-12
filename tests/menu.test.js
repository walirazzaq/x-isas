import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    avatarAdapter,
    badgeAdapter,
    HostRuntime,
    Isas,
    Menu,
    menuAdapter,
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

describe('menu presentation', () => {
    it('registers Menu without a standalone menu-item component', () => {
        expect(Isas.components.get('menu')).toBe(Menu);
        expect(Isas.adapters.get('menu')).toBe(menuAdapter);
        expect(Isas.components.has('menu-item')).toBe(false);
        expect(Isas.adapters.has('menu-item')).toBe(false);
    });

    it('adds menu size and orientation classes without replacing children', async () => {
        const host = mount(`
            <ul x-is="menu" size="sm" variant="horizontal" class="authored">
                <li data-child>Child</li>
            </ul>
        `);
        const child = host.querySelector('[data-child]');
        await tick();

        expect(host.className).toBe('menu menu-sm menu-horizontal authored');
        expect(host.querySelector('[data-child]')).toBe(child);

        host.setAttribute('size', 'xl');
        host.setAttribute('variant', 'vertical');
        await tick();

        expect(host.classList.contains('menu-sm')).toBe(false);
        expect(host.classList.contains('menu-horizontal')).toBe(false);
        expect(host.classList.contains('menu-xl')).toBe(true);
        expect(host.querySelector('[data-child]')).toBe(child);
    });

    it('renders parent-local item parts with scoped presentation', async () => {
        const host = mount(`
            <ul x-is="menu" item:content:class="parent-content">
                <li id="heading" x-part="item" heading="Workspace"></li>
                <li id="link" x-part="item" href="/settings" icon="i-tabler-settings">Settings</li>
                <li id="active" x-part="item" label="Inbox" active content:class="local-content"></li>
            </ul>
        `);
        await tick();

        expect(host.querySelector('#heading').classList.contains('menu-item')).toBe(true);
        expect(host.querySelector('#heading').classList.contains('menu-title')).toBe(true);
        expect(host.querySelector('#heading h2').textContent).toBe('Workspace');
        expect(host.querySelector('#link a').getAttribute('href')).toBe('/settings');
        expect(host.querySelector('#link .i-tabler-settings')).not.toBeNull();
        expect(host.querySelector('#active button').classList.contains('flex')).toBe(true);
        expect(host.querySelector('#active button').classList.contains('menu-active')).toBe(true);
        expect(host.querySelector('#active button').classList.contains('parent-content')).toBe(true);
        expect(host.querySelector('#active button').classList.contains('local-content')).toBe(true);
        expect(host.querySelectorAll(':scope > [x-part="item"]')).toHaveLength(3);
    });

    it('reacts to bound item-part structure and presentation attributes', async () => {
        const root = mount(`
            <div x-data="{ text: 'Run', destination: null, selected: false }">
                <ul x-is="menu">
                    <li x-part="item" :label="text" :href="destination" :active="selected"></li>
                </ul>
            </div>
        `);
        await tick();

        const menu = root.querySelector('[x-is="menu"]');
        const item = menu.querySelector('[x-part="item"]');
        expect(item.querySelector('button').textContent).toBe('Run');

        Alpine.$data(root).text = 'Open';
        await tick();
        expect(item.querySelector('button').textContent).toBe('Open');

        Alpine.$data(root).destination = '/open';
        Alpine.$data(root).selected = true;
        await tick();

        expect(menu.querySelector('[x-part="item"]')).toBe(item);
        expect(item.querySelector('button')).toBeNull();
        expect(item.querySelector('a').textContent).toBe('Open');
        expect(item.querySelector('a').getAttribute('href')).toBe('/open');
        expect(item.querySelector('a').classList.contains('menu-active')).toBe(true);
    });

    it('lets nested Menu boundaries own their own item parts', async () => {
        const host = mount(`
            <ul x-is="menu">
                <li x-part="item" label="Projects" collapsible open>
                    <ul x-is="menu" size="sm" variant="horizontal" slot="submenu"
                        class="authored-submenu">
                        <li x-part="item" label="Current"></li>
                        <li x-part="item" label="Archived"></li>
                    </ul>
                </li>
            </ul>
        `);
        await tick();

        const outerItem = host.querySelector(':scope > [x-part="item"]');
        const submenu = outerItem.querySelector(':scope > details > ul[x-is="menu"]');
        expect(outerItem.querySelector(':scope > details')).not.toBeNull();
        expect(submenu.classList.contains('authored-submenu')).toBe(true);
        expect(submenu.classList.contains('menu')).toBe(false);
        expect(submenu.classList.contains('menu-sm')).toBe(false);
        expect(submenu.classList.contains('menu-horizontal')).toBe(false);
        expect(submenu.querySelectorAll(':scope > [x-part="item"]')).toHaveLength(2);
        expect(submenu.textContent).toContain('Current');
        expect(submenu.textContent).toContain('Archived');
    });

    it('lets a replacement Menu adapter customize every item occurrence', async () => {
        Isas.adapters.register('menu', ({ attrs }) => ({
            host: { class: 'replacement-menu' },
            parts: {
                item: ({ attrs: itemAttrs, index }) => ({
                    host: {
                        class: [
                            'replacement-item',
                            itemAttrs.boolean('active') ? 'replacement-active' : '',
                        ],
                        'data-item-index': index,
                    },
                    parts: {
                        content: { class: 'replacement-content' },
                    },
                }),
            },
        }), { replace: true });

        try {
            const host = mount(`
                <ul x-is="menu">
                    <li x-part="item" label="One"></li>
                    <li x-part="item" label="Two" active></li>
                </ul>
            `);
            await tick();

            const items = host.querySelectorAll(':scope > [x-part="item"]');
            expect(host.classList.contains('replacement-menu')).toBe(true);
            expect(host.classList.contains('menu')).toBe(false);
            expect(items[0].dataset.itemIndex).toBe('0');
            expect(items[1].dataset.itemIndex).toBe('1');
            expect(items[1].classList.contains('replacement-active')).toBe(true);
            expect(items[0].querySelector('button').classList.contains('replacement-content'))
                .toBe(true);
            expect(items[0].classList.contains('menu-item')).toBe(false);
        } finally {
            Isas.adapters.register('menu', menuAdapter, { replace: true });
        }
    });

    it('settles after initializing composed and reactive item parts', async () => {
        const originalRender = Menu.prototype.render;
        let renders = 0;
        Menu.prototype.render = function renderMenuForCount() {
            renders += 1;
            return originalRender.call(this);
        };

        try {
            mount(`
                <div x-data="{ selected: 'home' }">
                    <ul x-is="menu">
                        <li x-part="item" label="Team" avatar="/team.png" badge-end="4"></li>
                        <li x-part="item" label="Docs" collapsible open>
                            <ul x-is="menu" slot="submenu">
                                <li x-part="item" label="Home"
                                    :active="selected === 'home'"></li>
                                <li x-part="item" label="Guides"
                                    :active="selected === 'guides'"></li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `);
            for (let index = 0; index < 5; index += 1) await tick();

            const menu = document.querySelector(':scope [x-is="menu"]');
            const items = [...menu.querySelectorAll('[x-part="item"]')];
            let redundantWrites = 0;
            for (const item of items) {
                const setAttribute = item.setAttribute.bind(item);
                item.setAttribute = (...args) => {
                    redundantWrites += 1;
                    return setAttribute(...args);
                };
            }

            HostRuntime.from(menu).renderNow();
            await tick();

            expect(redundantWrites).toBe(0);
            expect(renders).toBeGreaterThan(1);
            expect(renders).toBeLessThan(12);
        } finally {
            Menu.prototype.render = originalRender;
        }
    });
});

describe('menu item structure', () => {
    it('renders heading, link, and button modes with fallback precedence', async () => {
        const root = mount(`
            <ul x-is="menu">
                <li id="heading" x-part="item" heading="Workspace" label="Ignored"></li>
                <li id="authored" x-part="item" heading="Ignored">Authored <strong>title</strong></li>
                <li id="link" x-part="item" label="Settings" href="/settings" target="_blank"></li>
                <li id="button" x-part="item" label="Run" type="submit"></li>
            </ul>
        `);
        await tick();

        const heading = root.querySelector('#heading');
        expect(heading.classList.contains('menu-title')).toBe(true);
        expect(heading.querySelector('h2').textContent).toBe('Workspace');
        expect(heading.querySelector('h2').getAttribute('href')).toBeNull();

        expect(root.querySelector('#authored h2').textContent.trim()).toBe('Authored title');
        expect(root.querySelector('#link a').getAttribute('href')).toBe('/settings');
        expect(root.querySelector('#link a').getAttribute('target')).toBe('_blank');
        expect(root.querySelector('#button button').type).toBe('submit');
    });

    it('escapes generated labels but preserves authored markup', async () => {
        const root = mount(`
            <ul x-is="menu">
                <li id="generated" x-part="item" label="&lt;img src=x onerror=alert(1)&gt;"></li>
                <li id="authored" x-part="item"><em>Safe markup</em></li>
            </ul>
        `);
        await tick();

        expect(root.querySelector('#generated img')).toBeNull();
        expect(root.querySelector('#generated button').textContent).toBe('<img src=x onerror=alert(1)>');
        expect(root.querySelector('#authored button em').textContent).toBe('Safe markup');
    });

    it('routes content attributes and applies native disabled semantics', async () => {
        const root = mount(`
            <ul x-is="menu">
                <li id="button" x-part="item" disabled content:class="explicit">Button</li>
                <li id="link" x-part="item" disabled href="/unsafe" content:href="/authored">Link</li>
            </ul>
        `);
        await tick();

        const buttonHost = root.querySelector('#button');
        const button = buttonHost.querySelector('button');
        expect(buttonHost.classList.contains('menu-disabled')).toBe(true);
        expect(button.disabled).toBe(true);
        expect(button.classList.contains('explicit')).toBe(true);

        const link = root.querySelector('#link a');
        expect(link.hasAttribute('href')).toBe(false);
        expect(link.getAttribute('aria-disabled')).toBe('true');
        expect(link.getAttribute('tabindex')).toBe('-1');
    });

    it('puts active presentation on content and removes stale state classes', async () => {
        const menu = mount('<ul x-is="menu"><li x-part="item" active disabled class="authored">Item</li></ul>');
        await tick();

        const host = menu.firstElementChild;

        expect(host.className).toBe('menu-item menu-disabled authored');
        expect(host.querySelector('button').classList.contains('menu-active')).toBe(true);

        host.removeAttribute('active');
        host.removeAttribute('disabled');
        await tick();

        expect(host.className).toBe('menu-item authored');
        expect(host.querySelector('button').classList.contains('menu-active')).toBe(false);
        expect(host.querySelector('button').disabled).toBe(false);
    });

    it('supports arbitrary permanent part hosts while exposing the menu-item hook', async () => {
        const menu = mount('<ul x-is="menu"><div x-part="item" label="Flexible"></div></ul>');
        await tick();

        const host = menu.firstElementChild;

        expect(host.localName).toBe('div');
        expect(host.classList.contains('menu-item')).toBe(true);
        expect(host.querySelector('button').textContent).toBe('Flexible');
    });
});

describe('menu item accessories and submenus', () => {
    it('prepares avatar, icon, badge, icon-end, and badge-end in order', async () => {
        const menu = mount(`
            <ul x-is="menu">
                <li x-part="item" label="Profile" avatar="/people/team.png"
                    avatar:status="online" avatar:image:alt="Design team"
                    icon="i-tabler-user" icon:class="authored-icon" badge="Team"
                    icon-end="i-tabler-chevron-right" badge-end="4" badge-end:variant="soft">
                </li>
            </ul>
        `);
        await tick();

        const host = menu.firstElementChild;
        const content = host.querySelector('button');
        const prepend = content.firstElementChild;
        const append = content.lastElementChild;
        expect(prepend.children).toHaveLength(3);
        expect(prepend.children[0].getAttribute('x-is')).toBe('avatar');
        expect(prepend.children[0].classList.contains('avatar')).toBe(true);
        expect(prepend.children[0].classList.contains('avatar-online')).toBe(true);
        expect(prepend.children[0].getAttribute('src')).toBe('/people/team.png');
        expect(prepend.children[0].querySelector('img').getAttribute('alt')).toBe('Design team');
        expect(prepend.children[1].classList.contains('i-tabler-user')).toBe(true);
        expect(prepend.children[1].classList.contains('authored-icon')).toBe(true);
        expect(prepend.children[2].classList.contains('badge')).toBe(true);
        expect(prepend.children[2].getAttribute('x-is')).toBe('badge');
        expect(prepend.children[2].classList.contains('badge-sm')).toBe(true);
        expect(prepend.children[2].textContent).toContain('Team');
        expect(append.children).toHaveLength(2);
        expect(append.children[0].classList.contains('i-tabler-chevron-right')).toBe(true);
        expect(append.children[1].textContent).toContain('4');
        expect(append.children[1].getAttribute('variant')).toBe('soft');
        expect(append.children[1].classList.contains('badge-soft')).toBe(true);
    });

    it('uses image avatars and lets authored side slots override conveniences', async () => {
        const menu = mount(`
            <ul x-is="menu">
                <li x-part="item" avatar="/people/one.png" icon="ignored" badge="ignored"
                    icon-end="ignored-end" badge-end="ignored-end">
                    Item
                    <strong slot="prepend" class="custom-prepend">P</strong>
                    <small slot="append" class="custom-append">A</small>
                </li>
            </ul>
        `);
        await tick();

        const host = menu.firstElementChild;

        expect(host.querySelector('.custom-prepend')).not.toBeNull();
        expect(host.querySelector('.custom-append')).not.toBeNull();
        expect(host.querySelector('.avatar')).toBeNull();
        expect(host.querySelector('.ignored')).toBeNull();

        const imageMenu = mount('<ul x-is="menu"><li x-part="item" avatar="/people/one.png">Image</li></ul>');
        await tick();
        const imageHost = imageMenu.firstElementChild;
        expect(imageHost.querySelector('.avatar').classList.contains('avatar-placeholder')).toBe(false);
        expect(imageHost.querySelector('.avatar img').getAttribute('src')).toBe('/people/one.png');
    });

    it('uses replacement Badge and Avatar adapters for promoted conveniences', async () => {
        Isas.adapters.register('badge', () => ({
            host: { class: 'replacement-badge' },
        }), { replace: true });
        Isas.adapters.register('avatar', () => ({
            host: { class: 'replacement-avatar' },
            parts: { content: { class: 'replacement-avatar-content' } },
        }), { replace: true });

        try {
            const menu = mount(`
                <ul x-is="menu">
                    <li x-part="item" label="Composed" badge-end="8"
                        avatar="/people/replacement.png"></li>
                </ul>
            `);
            await tick();

            const host = menu.firstElementChild;

            expect(host.querySelector('[x-is="badge"]').classList.contains('replacement-badge')).toBe(true);
            expect(host.querySelector('[x-is="avatar"]').classList.contains('replacement-avatar')).toBe(true);
            expect(host.querySelector('[x-is="avatar"] > div')
                .classList.contains('replacement-avatar-content')).toBe(true);
        } finally {
            Isas.adapters.register('badge', badgeAdapter, { replace: true });
            Isas.adapters.register('avatar', avatarAdapter, { replace: true });
        }
    });

    it('updates generated badge and avatar parts from reconciled convenience attributes', async () => {
        const menu = mount(`
            <ul x-is="menu">
                <li x-part="item" wire:key="inbox" label="Inbox" badge-end="3"
                    avatar="/people/one.png"></li>
            </ul>
        `);
        await tick();

        const runtime = HostRuntime.from(menu);
        const host = menu.firstElementChild;
        const badge = host.querySelector('[x-is="badge"]');
        const avatar = host.querySelector('[x-is="avatar"]');
        expect('dataIsasGenerated' in Alpine.$data(badge).$badge).toBe(false);
        expect('dataIsasGenerated' in Alpine.$data(avatar).$avatar).toBe(false);
        expect(runtime.source.outerHTML()).not.toContain('data-isas-generated');
        expect(runtime.source.outerHTML()).not.toContain('x-is="badge"');

        const incoming = document.createElement('ul');
        incoming.setAttribute('x-is', 'menu');
        incoming.innerHTML = `
            <li x-part="item" wire:key="inbox" label="Inbox" badge-end="4"
                avatar="/people/two.png"></li>
        `;

        expect(runtime.reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.querySelector('[x-is="badge"]')).toBe(badge);
        expect(host.querySelector('[x-is="avatar"]')).toBe(avatar);
        expect(badge.textContent).toBe('4');
        expect(avatar.classList.contains('avatar-placeholder')).toBe(false);
        expect(avatar.querySelector('img').getAttribute('src')).toBe('/people/two.png');
        expect(HostRuntime.from(badge).source.innerHTML()).toBe('4');
        expect(HostRuntime.from(avatar).source.attributes.get('src')).toBe('/people/two.png');
        expect(host.querySelectorAll('.badge')).toHaveLength(1);
        expect(host.querySelectorAll('.avatar')).toHaveLength(1);

        host.setAttribute('badge-end', '5');
        await tick();
        expect(host.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('5');
        expect(HostRuntime.from(badge).source.innerHTML()).toBe('5');

        const replacement = document.createElement('ul');
        replacement.setAttribute('x-is', 'menu');
        replacement.innerHTML = `
            <li x-part="item" wire:key="inbox" label="Inbox" badge="New"
                badge-end="6"></li>
        `;
        expect(runtime.reconcileFrom(replacement)).toBe(true);
        await tick();

        expect(host.querySelector('[data-isas-generated="menu:item:avatar"]')).toBeNull();
        expect(HostRuntime.from(avatar)).toBeNull();
        expect(host.querySelector('[data-isas-generated="menu:item:badge"]').textContent).toBe('New');
        expect(host.querySelector('[data-isas-generated="menu:item:badge-end"]')).toBe(badge);
        expect(badge.textContent).toBe('6');
        expect(runtime.source.outerHTML()).not.toContain('data-isas-generated');
    });

    it('renders named submenus and nested collapsible menu items recursively', async () => {
        const menu = mount(`
            <ul x-is="menu">
                <li x-part="item" label="Projects" collapsible open details:class="shell"
                    submenu:aria-label="Nested projects">
                    <ul x-is="menu" slot="submenu" class="nested">
                        <li x-part="item" label="Current"></li>
                        <li x-part="item" label="Archived" collapsible>
                            <ul x-is="menu" slot="submenu">
                                <li x-part="item" label="2025"></li>
                            </ul>
                        </li>
                    </ul>
                </li>
            </ul>
        `);
        await tick();

        const host = menu.firstElementChild;
        const details = host.querySelector(':scope > details');
        expect(details.open).toBe(true);
        expect(details.classList.contains('shell')).toBe(true);
        expect(details.querySelector(':scope > summary').textContent).toContain('Projects');
        expect(details.querySelector(':scope > ul').classList.contains('nested')).toBe(true);
        expect(details.querySelector(':scope > ul').getAttribute('aria-label')).toBe('Nested projects');
        expect(details.querySelectorAll('[x-part="item"]')).toHaveLength(3);
        expect(details.querySelectorAll('details')).toHaveLength(1);
        expect(details.querySelector('details').open).toBe(false);
    });

    it('reconciles open state and nested content without duplicate shells', async () => {
        const menu = mount(`
            <ul x-is="menu">
                <li x-part="item" wire:key="projects" label="Projects" badge-end="1"
                    collapsible open>
                    <ul x-is="menu" slot="submenu"><li x-part="item" label="One"></li></ul>
                </li>
            </ul>
        `);
        await tick();

        const runtime = HostRuntime.from(menu);
        const host = menu.firstElementChild;
        const details = host.querySelector('details');
        const incoming = document.createElement('ul');
        incoming.setAttribute('x-is', 'menu');
        incoming.innerHTML = `
            <li x-part="item" wire:key="projects" label="Updated" badge-end="2" collapsible>
                <ul x-is="menu" slot="submenu">
                    <li x-part="item" label="Two"></li>
                    <li x-part="item" label="Three"></li>
                </ul>
            </li>
        `;

        expect(runtime.reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.querySelector('details')).toBe(details);
        expect(details.open).toBe(false);
        expect(details.querySelector('summary').textContent).toContain('Updated');
        expect(details.querySelectorAll(':scope > ul > [x-part="item"]')).toHaveLength(2);
        expect(host.querySelectorAll(':scope > details')).toHaveLength(1);
        expect(host.querySelector(':scope > details > summary [x-is="badge"]').textContent).toBe('2');
    });

    it('reconciles keyed item parts through the owning Menu Livewire boundary', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const componentRoot = mount(`
            <div wire:id="menu-parts-demo">
                <ul x-is="menu" size="sm">
                    <li x-part="item" wire:key="inbox-item" label="Before"
                        icon="i-tabler-home" badge-end="1"></li>
                </ul>
            </div>
        `);
        await tick();

        const menu = componentRoot.querySelector('[x-is="menu"]');
        const item = menu.querySelector('[x-part="item"]');
        const badge = item.querySelector('[x-is="badge"]');
        const incoming = document.createElement('ul');
        incoming.setAttribute('x-is', 'menu');
        incoming.setAttribute('size', 'lg');
        incoming.innerHTML = `
            <li x-part="item" wire:key="inbox-item" label="After"
                icon="i-tabler-settings" badge-end="2" active></li>
            <li x-part="item" wire:key="reports-item" label="Reports"></li>
        `;
        let skipped = false;

        morphUpdating({
            el: menu,
            toEl: incoming,
            component: { el: componentRoot },
            skip: () => { skipped = true; },
        });
        await tick();

        const currentItem = menu.querySelector('[wire\\:key="inbox-item"]');
        expect(skipped).toBe(true);
        expect(currentItem).toBe(item);
        expect(currentItem.querySelector('button').textContent).toContain('After');
        expect(currentItem.querySelector('.i-tabler-settings')).not.toBeNull();
        expect(currentItem.querySelector('.i-tabler-home')).toBeNull();
        expect(currentItem.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('2');
        expect(currentItem.querySelector('button').classList.contains('menu-active')).toBe(true);
        expect(menu.classList.contains('menu-lg')).toBe(true);
        expect(menu.querySelectorAll(':scope > [x-part="item"]')).toHaveLength(2);
        delete globalThis.Livewire;
    });

    it('exposes prepared slots and view data to custom render adapters', async () => {
        class CustomMenu extends Menu {}
        Isas.components.register('test-custom-menu', CustomMenu);
        Isas.adapters.register('test-custom-menu', {
            attributes: menuAdapter,
            render({ parts }) {
                return parts.ordered().map(({ slots, view }) => `
                    <article data-mode="${view.mode}" data-source="${view.contentSource}">
                        ${slots.get('prepend').html()}
                        ${slots.get('default').html()}
                        ${slots.get('append').html()}
                        ${slots.get('submenu').html()}
                    </article>
                `).join('');
            },
        });

        const host = mount(`
            <ul x-is="test-custom-menu">
                <li x-part="item" heading="Section" icon="i-tabler-list">
                    <ul slot="submenu"><li>Child</li></ul>
                </li>
            </ul>
        `);
        await tick();

        const article = host.querySelector('article');
        expect(article.dataset.mode).toBe('heading');
        expect(article.dataset.source).toBe('heading');
        expect(article.querySelector('.i-tabler-list')).not.toBeNull();
        expect(article.querySelector('ul li').textContent).toBe('Child');
    });
});
