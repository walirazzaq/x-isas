import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    HostRuntime,
    Isas,
    List,
    listAdapter,
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

describe('list presentation', () => {
    it('registers List without a standalone list-item component', () => {
        expect(Isas.components.get('list')).toBe(List);
        expect(Isas.adapters.get('list')).toBe(listAdapter);
        expect(Isas.components.has('list-item')).toBe(false);
        expect(Isas.adapters.has('list-item')).toBe(false);
    });

    it('preserves raw DaisyUI columns and unmarked children in source order', async () => {
        const host = mount(`
            <ul x-is="list" class="authored-list">
                <li id="heading" class="px-4 text-xs">Most played songs</li>
                <li id="song" x-part="item" class="authored-row">
                    <span data-index>01</span>
                    <img data-avatar class="size-10 rounded-box" src="avatar.webp" alt="">
                    <div data-main class="list-col-grow"><strong>Dio Lupa</strong></div>
                    <p data-description class="list-col-wrap">Long description</p>
                    <button x-is="button" size="xs">Play</button>
                </li>
                <li id="footer">Updated today</li>
            </ul>
        `);
        await tick();

        const row = host.querySelector('#song');
        expect(host.className).toBe('list text-base authored-list');
        expect([...host.children].map((child) => child.id))
            .toEqual(['heading', 'song', 'footer']);
        expect(row.className).toBe('list-row text-base gap-4 authored-row');
        expect(row.querySelector('[data-main]').classList.contains('list-col-grow')).toBe(true);
        expect(row.querySelector('[data-description]').classList.contains('list-col-wrap'))
            .toBe(true);
        expect(row.querySelector('[data-index]').parentElement).toBe(row);
        expect(row.querySelector('button').classList.contains('btn')).toBe(true);
        expect(row.hasAttribute('aria-selected')).toBe(false);
        expect(row.hasAttribute('aria-disabled')).toBe(false);
    });

    it('composes heading, subheading, description, and generated accessories', async () => {
        const host = mount(`
            <ul x-is="list" size="sm">
                <li x-part="item"
                    avatar="avatar.webp"
                    avatar:alt="Dio Lupa"
                    icon="i-tabler-music"
                    badge="new"
                    heading="Dio Lupa"
                    subheading="Remaining Reason"
                    description="Long description"
                    icon-end="i-tabler-player-play"
                    badge-end="4:12"></li>
            </ul>
        `);
        await tick();

        const row = host.querySelector('[x-part="item"]');
        const children = [...row.children];
        const prepend = children[0];
        const main = children[1];
        const description = children[2];
        const append = children[3];

        expect(row.classList.contains('list-row')).toBe(true);
        expect(row.classList.contains('text-sm')).toBe(true);
        expect(row.classList.contains('gap-3')).toBe(true);
        expect(prepend.children[0].getAttribute('x-is')).toBe('avatar');
        expect(prepend.children[0].querySelector('img').src).toContain('avatar.webp');
        expect(prepend.children[0].querySelector('img').alt).toBe('Dio Lupa');
        expect(prepend.children[1].classList.contains('i-tabler-music')).toBe(true);
        expect(prepend.children[2].getAttribute('x-is')).toBe('badge');
        expect(prepend.children[2].textContent).toBe('new');
        expect(main.classList.contains('list-col-grow')).toBe(true);
        expect(main.children[0].textContent).toBe('Dio Lupa');
        expect(main.children[1].textContent).toBe('Remaining Reason');
        expect(description.classList.contains('list-col-wrap')).toBe(true);
        expect(description.textContent).toBe('Long description');
        expect(append.children[0].classList.contains('i-tabler-player-play')).toBe(true);
        expect(append.children[1].getAttribute('x-is')).toBe('badge');
        expect(append.children[1].textContent).toBe('4:12');
    });

    it('supports bare configured avatars and suppresses false avatars', async () => {
        const host = mount(`
            <ul x-is="list" size="lg">
                <li id="configured" x-part="item" avatar
                    avatar:icon="i-tabler-user" avatar:color="info"
                    heading="Configured"></li>
                <li id="disabled" x-part="item" avatar="false"
                    heading="No avatar"></li>
            </ul>
        `);
        await tick();

        const configured = host.querySelector('#configured');
        const avatar = configured.querySelector('[x-is="avatar"]');
        expect(avatar).not.toBeNull();
        expect(avatar.querySelector('.i-tabler-user')).not.toBeNull();
        expect(avatar.firstElementChild.classList.contains('size-12')).toBe(true);
        expect(avatar.firstElementChild.classList.contains('bg-info')).toBe(true);

        const disabled = host.querySelector('#disabled');
        expect(disabled.querySelector('[x-is="avatar"]')).toBeNull();
        expect(disabled.firstElementChild.classList.contains('list-col-grow')).toBe(true);
    });

    it('lets named slots override attributes and generated accessories', async () => {
        const host = mount(`
            <ul x-is="list">
                <li x-part="item" avatar="ignored.webp" icon="ignored-start"
                    badge="ignored" heading="Attribute heading"
                    subheading="Attribute subheading"
                    description="Attribute description"
                    icon-end="ignored-end" badge-end="ignored">
                    <span slot="prepend" data-prepend>Custom prepend</span>
                    <strong slot="heading">Slot heading</strong>
                    <small slot="subheading">Slot subheading</small>
                    <p slot="description">Slot description</p>
                    <button slot="append" data-append>Custom append</button>
                </li>
            </ul>
        `);
        await tick();

        const row = host.querySelector('[x-part="item"]');
        expect(row.querySelector('[data-prepend]')).not.toBeNull();
        expect(row.querySelector('[data-append]')).not.toBeNull();
        expect(row.querySelector('[x-is="avatar"]')).toBeNull();
        expect(row.querySelector('.ignored-start')).toBeNull();
        expect(row.querySelector('.ignored-end')).toBeNull();
        expect(row.textContent).toContain('Slot heading');
        expect(row.textContent).toContain('Slot subheading');
        expect(row.textContent).toContain('Slot description');
        expect(row.textContent).not.toContain('Attribute heading');
        expect(row.textContent).not.toContain('Attribute subheading');
        expect(row.textContent).not.toContain('Attribute description');
    });

    it('uses default content as the composed heading fallback', async () => {
        const host = mount(`
            <ul x-is="list" item:heading:class="parent-heading">
                <li x-part="item" heading:class="local-heading">
                    Default heading
                </li>
            </ul>
        `);
        await tick();

        const row = host.querySelector('[x-part="item"]');
        const heading = row.querySelector('.parent-heading.local-heading');
        expect(heading.textContent.trim()).toBe('Default heading');
        expect(heading.parentElement.classList.contains('list-col-grow')).toBe(true);
    });

    it('inherits reactive parent size while respecting an item override', async () => {
        const root = mount(`
            <div x-data="{ size: 'sm' }">
                <ul x-is="list" :size="size">
                    <li id="inherited" x-part="item" avatar
                        avatar:icon="i-tabler-user" heading="Inherited"></li>
                    <li id="fixed" x-part="item" size="xs" heading="Fixed"></li>
                </ul>
            </div>
        `);
        await tick();

        const list = root.querySelector('[x-is="list"]');
        const inherited = list.querySelector('#inherited');
        const fixed = list.querySelector('#fixed');
        expect(list.classList.contains('text-sm')).toBe(true);
        expect(inherited.classList.contains('text-sm')).toBe(true);
        expect(inherited.classList.contains('gap-3')).toBe(true);
        expect(inherited.querySelector('[x-is="avatar"]').firstElementChild.classList
            .contains('size-8')).toBe(true);
        expect(fixed.classList.contains('text-xs')).toBe(true);
        expect(fixed.classList.contains('gap-2')).toBe(true);

        Alpine.$data(root).size = 'xl';
        await tick();

        expect(list.classList.contains('text-sm')).toBe(false);
        expect(list.classList.contains('text-xl')).toBe(true);
        expect(inherited.classList.contains('text-sm')).toBe(false);
        expect(inherited.classList.contains('text-xl')).toBe(true);
        expect(inherited.classList.contains('gap-6')).toBe(true);
        expect(inherited.querySelector('[x-is="avatar"]').firstElementChild.classList
            .contains('size-14')).toBe(true);
        expect(fixed.classList.contains('text-xs')).toBe(true);
        expect(fixed.classList.contains('gap-2')).toBe(true);
    });

    it('reconciles keyed item parts through the owning List Livewire boundary', async () => {
        let morphUpdating;
        globalThis.Livewire = {
            hook(name, callback) {
                if (name === 'morph.updating') morphUpdating = callback;
            },
        };
        window.dispatchEvent(new CustomEvent('livewire:init'));

        const componentRoot = mount(`
            <div wire:id="list-parts-demo">
                <ul x-is="list" size="sm">
                    <li x-part="item" wire:key="song-item" heading="Before"
                        icon="i-tabler-home" badge-end="1">
                        <div slot="description" wire:id="nested-list-child">Nested child</div>
                    </li>
                </ul>
            </div>
        `);
        await tick();

        const list = componentRoot.querySelector('[x-is="list"]');
        const item = list.querySelector('[x-part="item"]');
        const badge = item.querySelector('[x-is="badge"]');
        const nestedChild = item.querySelector('[wire\\:id="nested-list-child"]');
        const incoming = document.createElement('ul');
        incoming.setAttribute('x-is', 'list');
        incoming.setAttribute('size', 'lg');
        incoming.innerHTML = `
            <li x-part="item" wire:key="song-item" heading="After"
                icon="i-tabler-settings" badge-end="2">
                <div slot="description" wire:id="nested-list-child">Server replacement</div>
            </li>
            <li x-part="item" wire:key="second-item" heading="Second"></li>
        `;
        let skipped = false;

        morphUpdating({
            el: list,
            toEl: incoming,
            component: { el: componentRoot },
            skip: () => { skipped = true; },
        });
        await tick();

        const currentItem = list.querySelector('[wire\\:key="song-item"]');
        expect(skipped).toBe(true);
        expect(currentItem).toBe(item);
        expect(currentItem.textContent).toContain('After');
        expect(currentItem.querySelector('.i-tabler-settings')).not.toBeNull();
        expect(currentItem.querySelector('.i-tabler-home')).toBeNull();
        expect(currentItem.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.textContent).toBe('2');
        expect(currentItem.querySelector('[wire\\:id="nested-list-child"]')).toBe(nestedChild);
        expect(nestedChild.textContent).toBe('Nested child');
        expect(currentItem.classList.contains('text-lg')).toBe(true);
        expect(list.querySelectorAll(':scope > [x-part="item"]')).toHaveLength(2);
        delete globalThis.Livewire;
    });

    it('does not synthesize selection or disabled behavior', async () => {
        const host = mount(`
            <ul x-is="list">
                <li x-part="item" heading="Informational" value="one"
                    selected disabled optionable></li>
            </ul>
        `);
        await tick();

        const row = host.querySelector('[x-part="item"]');
        expect(row.hasAttribute('selected')).toBe(true);
        expect(row.hasAttribute('disabled')).toBe(true);
        expect(row.hasAttribute('optionable')).toBe(true);
        expect(row.hasAttribute('aria-selected')).toBe(false);
        expect(row.hasAttribute('aria-disabled')).toBe(false);
        expect(row.hasAttribute('tabindex')).toBe(false);
        expect(row.classList.contains('pointer-events-none')).toBe(false);
    });
});
