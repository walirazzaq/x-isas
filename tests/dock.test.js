import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Dock,
    Isas,
    dockAdapter,
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

describe('dock presentation', () => {
    it('registers Dock without a standalone item component', () => {
        expect(Isas.components.get('dock')).toBe(Dock);
        expect(Isas.adapters.get('dock')).toBe(dockAdapter);
        expect(Isas.components.has('dock-item')).toBe(false);
        expect(Isas.components.has('item')).toBe(false);
        expect(Isas.adapters.has('item')).toBe(false);
    });

    it('maps every explicit size and leaves missing or unknown values at the base size', async () => {
        const root = mount(`
            <div>
                ${['xs', 'sm', 'md', 'lg', 'xl'].map((size) => (
                    `<nav x-is="dock" size="${size}"></nav>`
                )).join('')}
                <nav x-is="dock"></nav>
                <nav x-is="dock" size="huge"></nav>
            </div>
        `);
        await tick();

        const docks = root.querySelectorAll('[x-is="dock"]');
        ['xs', 'sm', 'md', 'lg', 'xl'].forEach((size, index) => {
            expect(docks[index].className).toBe(`dock dock-${size}`);
        });
        expect(docks[5].className).toBe('dock');
        expect(docks[6].className).toBe('dock');
    });

    it('reacts to size changes without leaving stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ size: 'xs' }">
                <nav x-is="dock" :size="size" class="md:dock-lg authored"></nav>
            </div>
        `);
        await tick();

        const dock = root.querySelector('[x-is="dock"]');
        expect(dock.className).toBe('dock dock-xs md:dock-lg authored');

        Alpine.$data(root).size = 'xl';
        await tick();
        expect(dock.className).toBe('dock dock-xl md:dock-lg authored');

        Alpine.$data(root).size = 'unknown';
        await tick();
        expect(dock.className).toBe('dock md:dock-lg authored');
    });

    it('preserves arbitrary item tags, unmarked children, and source order', async () => {
        const host = mount(`
            <nav x-is="dock">
                <span data-unmarked>Separator</span>
                <a x-part="item" href="/home">Home</a>
                <button x-part="item" type="button">Search</button>
                <div x-part="item">Profile</div>
            </nav>
        `);
        const authored = [...host.children];
        await tick();

        expect([...host.children]).toEqual(authored);
        expect([...host.children].map((item) => item.localName))
            .toEqual(['span', 'a', 'button', 'div']);
        expect(host.children[1].getAttribute('href')).toBe('/home');
        expect(host.children[2].getAttribute('type')).toBe('button');
        expect(host.children[0].hasAttribute('x-part')).toBe(false);
    });

    it('preserves exact raw DaisyUI icon and label markup', async () => {
        const host = mount(`
            <nav x-is="dock">
                <button x-part="item" type="button">
                    <svg data-raw-icon viewBox="0 0 10 10"><path d="M0 0h1v1z"></path></svg>
                    <span class="dock-label" data-raw-label>Home</span>
                </button>
            </nav>
        `);
        const icon = host.querySelector('[data-raw-icon]');
        const label = host.querySelector('[data-raw-label]');
        await tick();

        const item = host.querySelector('[x-part="item"]');
        expect(item.querySelector('[data-raw-icon]')).toBe(icon);
        expect(item.querySelector('[data-raw-label]')).toBe(label);
        expect(item.children).toHaveLength(2);
        expect(item.querySelectorAll('.dock-label')).toHaveLength(1);
    });

    it('composes icon shorthand and authored content into icon and label regions', async () => {
        const host = mount(`
            <nav x-is="dock">
                <button x-part="item" icon="i-tabler-home" icon:class="text-xl"
                    icon:data-icon="home" label:class="font-semibold">
                    Home <strong>base</strong>
                </button>
            </nav>
        `);
        await tick();

        const item = host.querySelector('[x-part="item"]');
        expect(item.children).toHaveLength(2);
        expect(item.children[0].className).toBe('i-tabler-home text-xl');
        expect(item.children[0].getAttribute('data-icon')).toBe('home');
        expect(item.children[1].className).toBe('dock-label font-semibold');
        expect(item.children[1].textContent.trim()).toBe('Home base');
        expect(item.children[1].querySelector('strong')).not.toBeNull();
    });

    it('uses label slot, default content, then escaped label fallback in precedence order', async () => {
        const host = mount(`
            <nav x-is="dock">
                <button id="slotted" x-part="item" label="Ignored" icon="i-tabler-star">
                    Ignored default
                    <span slot="label"><strong>Slotted label</strong></span>
                </button>
                <button id="authored" x-part="item" label="Ignored" icon="i-tabler-star">
                    Authored <em>label</em>
                </button>
                <button id="fallback" x-part="item" label="&lt;img src=x onerror=alert(1)&gt;"></button>
            </nav>
        `);
        await tick();

        expect(host.querySelector('#slotted .dock-label').textContent).toBe('Slotted label');
        expect(host.querySelector('#slotted .dock-label strong')).not.toBeNull();
        expect(host.querySelector('#slotted').textContent).not.toContain('Ignored');
        expect(host.querySelector('#authored .dock-label').textContent.trim())
            .toBe('Authored label');
        expect(host.querySelector('#authored .dock-label em')).not.toBeNull();
        expect(host.querySelector('#fallback img')).toBeNull();
        expect(host.querySelector('#fallback').textContent)
            .toBe('<img src=x onerror=alert(1)>');
    });

    it('uses an icon slot instead of its shorthand and keeps nested components intact', async () => {
        const host = mount(`
            <nav x-is="dock">
                <button x-part="item" icon="i-tabler-ignored" icon:class="text-lg"
                    icon:data-region="custom" label="Inbox">
                    <span slot="icon"><span x-is="badge" size="xs">3</span></span>
                </button>
            </nav>
        `);
        await tick();

        const item = host.querySelector('[x-part="item"]');
        const icon = item.firstElementChild;
        expect(icon.classList.contains('i-tabler-ignored')).toBe(false);
        expect(icon.classList.contains('text-lg')).toBe(true);
        expect(icon.getAttribute('data-region')).toBe('custom');
        expect(icon.querySelector('[x-is="badge"]').classList.contains('badge-xs')).toBe(true);
        expect(item.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
    });

    it('applies parent item defaults while local values take precedence', async () => {
        const host = mount(`
            <nav x-is="dock" item:active item:icon:class="parent-icon"
                item:label:class="parent-label">
                <button id="inherited" x-part="item" icon="i-tabler-home" label="Home"></button>
                <a id="local" x-part="item" active="false" icon="i-tabler-user"
                    icon:class="local-icon" label="Profile" label:class="local-label"></a>
            </nav>
        `);
        await tick();

        const inherited = host.querySelector('#inherited');
        const local = host.querySelector('#local');
        expect(inherited.classList.contains('dock-active')).toBe(true);
        expect(inherited.firstElementChild.classList.contains('parent-icon')).toBe(true);
        expect(inherited.querySelector('.dock-label').classList.contains('parent-label')).toBe(true);
        expect(local.classList.contains('dock-active')).toBe(false);
        expect(local.firstElementChild.className)
            .toBe('i-tabler-user parent-icon local-icon');
        expect(local.querySelector('.dock-label').className)
            .toBe('dock-label parent-label local-label');
    });

    it('maps active presentation independently and preserves authored semantics', async () => {
        const host = mount(`
            <nav x-is="dock" aria-label="Primary">
                <a id="page" x-part="item" href="/home" active aria-current="page">Home</a>
                <button id="pressed" x-part="item" active="1" aria-pressed="true" disabled>Search</button>
                <div id="inactive" x-part="item" active="false" role="link">Profile</div>
                <span id="also-active" x-part="item" active="yes">Other</span>
            </nav>
        `);
        await tick();

        expect(host.querySelectorAll('.dock-active')).toHaveLength(3);
        expect(host.querySelector('#page').getAttribute('aria-current')).toBe('page');
        expect(host.querySelector('#page').getAttribute('href')).toBe('/home');
        expect(host.querySelector('#pressed').getAttribute('aria-pressed')).toBe('true');
        expect(host.querySelector('#pressed').disabled).toBe(true);
        expect(host.querySelector('#inactive').classList.contains('dock-active')).toBe(false);
        expect(host.querySelector('#inactive').getAttribute('role')).toBe('link');
        expect(host.querySelector('#also-active').hasAttribute('aria-current')).toBe(false);
        expect(host.getAttribute('role')).toBeNull();
    });

    it('reacts to active and composition changes on a stable item host', async () => {
        const root = mount(`
            <div x-data="{ active: false, icon: null, label: 'Home' }">
                <nav x-is="dock">
                    <button x-part="item" :active="active" :icon="icon" :label="label"></button>
                </nav>
            </div>
        `);
        await tick();

        const item = root.querySelector('[x-part="item"]');
        expect(item.classList.contains('dock-active')).toBe(false);
        expect(item.querySelector('[class^="i-tabler-"]')).toBeNull();
        expect(item.querySelector('.dock-label').textContent).toBe('Home');

        Alpine.$data(root).active = true;
        Alpine.$data(root).icon = 'i-tabler-home';
        Alpine.$data(root).label = 'Start';
        await tick();

        expect(root.querySelector('[x-part="item"]')).toBe(item);
        expect(item.classList.contains('dock-active')).toBe(true);
        expect(item.querySelector('.i-tabler-home')).not.toBeNull();
        expect(item.querySelector('.dock-label').textContent).toBe('Start');

        Alpine.$data(root).active = false;
        await tick();
        expect(item.classList.contains('dock-active')).toBe(false);
    });

    it('reconciles keyed item order, composition, and nested icon identity', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const componentRoot = mount(`
            <div wire:id="dock-parts-demo">
                <nav x-is="dock" size="sm">
                    <button x-part="item" wire:key="home">Home</button>
                    <button x-part="item" wire:key="inbox" active label="Inbox">
                        <span slot="icon"><span x-is="badge" size="xs">2</span></span>
                    </button>
                </nav>
            </div>
        `);
        await tick();

        const host = componentRoot.querySelector('[x-is="dock"]');
        const inbox = host.querySelector('[wire\\:key="inbox"]');
        const badge = inbox.querySelector('[x-is="badge"]');
        const incoming = document.createElement('nav');
        incoming.setAttribute('x-is', 'dock');
        incoming.setAttribute('size', 'lg');
        incoming.innerHTML = `
            <button x-part="item" wire:key="inbox" label="Messages">
                <span slot="icon"><span x-is="badge" size="xs">4</span></span>
            </button>
            <button x-part="item" wire:key="home" active icon="i-tabler-home"
                aria-current="page">Start</button>
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
        expect(items[0]).toBe(inbox);
        expect(inbox.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('4');
        expect(inbox.querySelector('.dock-label').textContent).toBe('Messages');
        expect(items[1].classList.contains('dock-active')).toBe(true);
        expect(items[1].querySelector('.i-tabler-home')).not.toBeNull();
        expect(items[1].getAttribute('aria-current')).toBe('page');
        expect(host.classList.contains('dock-lg')).toBe(true);
    });

    it('restores the canonical authored tree on teardown', async () => {
        const host = mount(`
            <nav x-is="dock" size="lg" class="authored">
                <button x-part="item" active icon="i-tabler-home" label="Home"></button>
            </nav>
        `);
        await tick();
        expect(host.querySelector('.dock-label')).not.toBeNull();

        Alpine.destroyTree(host);

        expect(host.className).toBe('authored');
        expect(host.firstElementChild.className).toBe('');
        expect(host.firstElementChild.childElementCount).toBe(0);
        expect(host.firstElementChild.getAttribute('icon')).toBe('i-tabler-home');
        expect(host.firstElementChild.getAttribute('label')).toBe('Home');
        expect(host.firstElementChild.hasAttribute('active')).toBe(true);
    });
});
