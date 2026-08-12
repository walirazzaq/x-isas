import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Alert,
    HostRuntime,
    Isas,
    alertAdapter,
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

describe('alert', () => {
    it('registers the component and DaisyUI adapter', () => {
        expect(Isas.components.get('alert')).toBe(Alert);
        expect(Isas.adapters.get('alert')).toBe(alertAdapter);
    });

    it('maps presentation attributes and preserves authored classes and semantics', async () => {
        const host = mount(`
            <section x-is="alert" color="info" variant="soft" direction="vertical"
                role="status" class="authored-alert">A release is available.</section>
        `);
        await tick();

        expect(host.className)
            .toBe('alert alert-info alert-soft alert-vertical authored-alert');
        expect(host.getAttribute('role')).toBe('status');
        expect(host.hasAttribute('aria-live')).toBe(false);
        expect(host.children).toHaveLength(1);
        expect(host.firstElementChild.className).toBe('min-w-0');
        expect(host.firstElementChild.textContent).toContain('A release is available.');
    });

    it('does not synthesize accessibility semantics', async () => {
        const host = mount('<div x-is="alert">Saved.</div>');
        await tick();

        expect(host.hasAttribute('role')).toBe(false);
        expect(host.hasAttribute('aria-live')).toBe(false);
    });

    it('reacts to presentation changes without leaving stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ color: 'success', variant: 'outline', direction: 'horizontal' }">
                <div x-is="alert" :color="color" :variant="variant"
                    :direction="direction" class="authored-alert">Saved.</div>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="alert"]');
        expect(host.classList.contains('alert-success')).toBe(true);
        expect(host.classList.contains('alert-outline')).toBe(true);
        expect(host.classList.contains('alert-horizontal')).toBe(true);

        Alpine.$data(root).color = 'warning';
        Alpine.$data(root).variant = 'dash';
        Alpine.$data(root).direction = 'vertical';
        await tick();

        expect(host.className)
            .toBe('alert alert-warning alert-dash alert-vertical authored-alert');

        Alpine.$data(root).color = 'unknown';
        Alpine.$data(root).variant = 'unknown';
        Alpine.$data(root).direction = 'unknown';
        await tick();

        expect(host.className).toBe('alert authored-alert');
    });

    it('renders icon and Badge shorthands in their documented order', async () => {
        const host = mount(`
            <div x-is="alert" icon="i-tabler-info-circle" badge="New"
                icon-end="i-tabler-arrow-right" badge-end="3"
                icon:class="text-lg" badge:color="info"
                badge-end:variant="outline">Updates available.</div>
        `);
        await tick();

        const [prepend, content, append] = host.children;
        expect(prepend.className).toBe('inline-flex shrink-0 items-center gap-2');
        expect(prepend.children[0].className).toContain('i-tabler-info-circle');
        expect(prepend.children[0].className).toContain('text-lg');
        expect(prepend.children[1].matches('[x-is="badge"]')).toBe(true);
        expect(prepend.children[1].className).toContain('badge-info');
        expect(prepend.children[1].getAttribute('size')).toBe('sm');
        expect(prepend.children[1].textContent).toBe('New');
        expect(content.textContent).toContain('Updates available.');
        expect(append.children[0].className).toContain('i-tabler-arrow-right');
        expect(append.children[1].matches('[x-is="badge"]')).toBe(true);
        expect(append.children[1].className).toContain('badge-outline');
        expect(append.children[1].textContent).toBe('3');
        expect(host.querySelectorAll('[data-isas-generated]')).toHaveLength(2);
    });

    it('lets authored side slots replace shorthand accessories', async () => {
        const host = mount(`
            <div x-is="alert" icon="i-tabler-info-circle" badge="Ignored"
                icon-end="i-tabler-arrow-right" badge-end="9">
                Message
                <span slot="prepend" data-custom-prepend>Custom lead</span>
                <div slot="append" data-custom-append>
                    <button x-is="button">Review</button>
                </div>
            </div>
        `);
        await tick();

        expect(host.querySelector('[data-custom-prepend]')).not.toBeNull();
        expect(host.querySelector('[data-custom-append]')).not.toBeNull();
        expect(host.querySelector('.i-tabler-info-circle')).toBeNull();
        expect(host.querySelector('.i-tabler-arrow-right')).toBeNull();
        expect(host.querySelector('[x-is="badge"]')).toBeNull();
        expect(host.querySelector('[x-is="button"]')).not.toBeNull();
    });

    it('supports heading and default-description composition', async () => {
        const host = mount(`
            <div x-is="alert" heading="New message!"
                content:data-region="body" heading:class="tracking-wide"
                description:class="opacity-70">
                You have one unread message.
            </div>
        `);
        await tick();

        const content = host.querySelector('[data-region="body"]');
        expect(content.className).toContain('min-w-0');
        expect(content.children).toHaveLength(2);
        expect(content.children[0].className).toBe('font-bold tracking-wide');
        expect(content.children[0].textContent).toBe('New message!');
        expect(content.children[1].className).toBe('text-xs opacity-70');
        expect(content.children[1].textContent.trim()).toBe('You have one unread message.');
    });

    it('prefers named slots over attributes and explicit descriptions over default content', async () => {
        const host = mount(`
            <div x-is="alert" heading="Attribute heading"
                description="Attribute description">
                Suppressed default description
                <strong slot="heading">Slot heading</strong>
                <span slot="description"><em>Slot description</em></span>
            </div>
        `);
        await tick();

        expect(host.textContent).toContain('Slot heading');
        expect(host.textContent).toContain('Slot description');
        expect(host.textContent).not.toContain('Attribute heading');
        expect(host.textContent).not.toContain('Attribute description');
        expect(host.textContent).not.toContain('Suppressed default description');
        expect(host.querySelector('em')).not.toBeNull();
    });

    it('escapes heading, description, and Badge shorthand text', async () => {
        const host = mount(`
            <div x-is="alert" heading="&lt;strong&gt;Unsafe&lt;/strong&gt;"
                description="&lt;em&gt;Description&lt;/em&gt;"
                badge="&lt;img src=x onerror=alert(1)&gt;"></div>
        `);
        await tick();

        expect(host.querySelector('strong')).toBeNull();
        expect(host.querySelector('em')).toBeNull();
        expect(host.querySelector('img')).toBeNull();
        expect(host.textContent).toContain('<strong>Unsafe</strong>');
        expect(host.textContent).toContain('<em>Description</em>');
        expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    it('preserves generated Badge and authored nested component identity on reconciliation', async () => {
        const host = mount(`
            <div x-is="alert" badge="1" heading="Inbox">
                One unread message
                <div slot="append"><button x-is="button">Review</button></div>
            </div>
        `);
        await tick();

        const badge = host.querySelector('[x-is="badge"]');
        const button = host.querySelector('[x-is="button"]');
        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'alert');
        incoming.setAttribute('badge', '2');
        incoming.setAttribute('badge:color', 'warning');
        incoming.setAttribute('heading', 'Inbox updated');
        incoming.innerHTML = `
            Two unread messages
            <div slot="append"><button x-is="button" color="primary">Review now</button></div>
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.querySelector('[x-is="badge"]')).toBe(badge);
        expect(host.querySelector('[x-is="button"]')).toBe(button);
        expect(host.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
        expect(badge.textContent).toBe('2');
        expect(badge.classList.contains('badge-warning')).toBe(true);
        expect(button.textContent).toBe('Review now');
        expect(button.classList.contains('btn-primary')).toBe(true);
        expect(host.textContent).toContain('Inbox updated');
        expect(host.textContent).toContain('Two unread messages');
    });

    it('restores canonical authored content and attributes on teardown', async () => {
        const host = mount(`
            <div x-is="alert" color="error" icon="i-tabler-alert-circle"
                heading="Failure">Try again.</div>
        `);
        await tick();
        expect(host.classList.contains('alert-error')).toBe(true);
        expect(host.children).toHaveLength(2);

        Alpine.destroyTree(host);

        expect(host.className).toBe('');
        expect(host.children).toHaveLength(0);
        expect(host.textContent).toBe('Try again.');
        expect(host.getAttribute('heading')).toBe('Failure');
        expect(host.getAttribute('icon')).toBe('i-tabler-alert-circle');
    });
});
