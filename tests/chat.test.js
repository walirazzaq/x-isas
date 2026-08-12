import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Chat,
    HostRuntime,
    Isas,
    chatAdapter,
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

describe('chat', () => {
    it('registers the component and DaisyUI adapter', () => {
        expect(Isas.components.get('chat')).toBe(Chat);
        expect(Isas.adapters.get('chat')).toBe(chatAdapter);
    });

    it('renders the concise composed API in canonical region order', async () => {
        const host = mount(`
            <article x-is="chat" color="primary" avatar="/obi-wan.jpg"
                avatar:alt="Obi-Wan Kenobi" header="Obi-Wan Kenobi"
                footer="Delivered" class="authored sm:chat-end">
                You were the Chosen One!
            </article>
        `);
        await tick();

        expect(host.className).toBe('chat chat-start authored sm:chat-end');
        expect([...host.children].map((child) => child.className)).toEqual([
            'chat-image',
            'chat-header',
            'chat-bubble chat-bubble-primary',
            'chat-footer',
        ]);
        const avatar = host.querySelector('[data-isas-generated="chat:avatar"]');
        expect(avatar.matches('[x-is="avatar"]')).toBe(true);
        expect(avatar.querySelector('img').getAttribute('src')).toBe('/obi-wan.jpg');
        expect(avatar.querySelector('img').getAttribute('alt')).toBe('Obi-Wan Kenobi');
        expect(host.querySelector('.chat-header').textContent).toBe('Obi-Wan Kenobi');
        expect(host.querySelector('.chat-bubble').textContent.trim())
            .toBe('You were the Chosen One!');
        expect(host.querySelector('.chat-footer').textContent).toBe('Delivered');
    });

    it('maps both placements and all documented bubble colors', async () => {
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
        const root = mount(`
            <div>${colors.map((color, index) => `
                <div x-is="chat" placement="${index % 2 ? 'end' : 'start'}"
                    color="${color}">${color}</div>
            `).join('')}</div>
        `);
        await tick();

        [...root.children].forEach((host, index) => {
            expect(host.classList.contains(index % 2 ? 'chat-end' : 'chat-start')).toBe(true);
            expect(host.firstElementChild.classList.contains(`chat-bubble-${colors[index]}`))
                .toBe(true);
        });
    });

    it('reacts to presentation changes and removes stale managed classes', async () => {
        const root = mount(`
            <div x-data="{ placement: 'start', color: 'success' }">
                <div x-is="chat" :placement="placement" :color="color"
                    class="authored">Saved.</div>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="chat"]');
        const bubble = host.querySelector('.chat-bubble');
        expect(host.className).toBe('chat chat-start authored');
        expect(bubble.className).toBe('chat-bubble chat-bubble-success');

        Alpine.$data(root).placement = 'end';
        Alpine.$data(root).color = 'warning';
        await tick();

        expect(host.className).toBe('chat chat-end authored');
        expect(host.querySelector('.chat-bubble')).toBe(bubble);
        expect(bubble.className).toBe('chat-bubble chat-bubble-warning');

        Alpine.$data(root).placement = 'unknown';
        Alpine.$data(root).color = 'unknown';
        await tick();

        expect(host.className).toBe('chat authored');
        expect(bubble.className).toBe('chat-bubble');
    });

    it('routes region and generated Avatar namespaces', async () => {
        const host = mount(`
            <div x-is="chat" avatar="/team.jpg"
                image:class="self-start" image:data-region="portrait"
                avatar:size="sm" avatar:class="ringed"
                header:class="font-semibold" bubble:class="max-w-md"
                footer:class="opacity-50" header="Team" footer="Seen">
                Hello <strong>team</strong>.
            </div>
        `);
        await tick();

        expect(host.querySelector('[data-region="portrait"]').className)
            .toBe('chat-image self-start');
        const avatar = host.querySelector('[x-is="avatar"]');
        expect(avatar.className).toBe('avatar ringed');
        expect(avatar.getAttribute('size')).toBe('sm');
        expect(host.querySelector('.chat-header').className)
            .toBe('chat-header font-semibold');
        expect(host.querySelector('.chat-bubble').className)
            .toBe('chat-bubble max-w-md');
        expect(host.querySelector('.chat-bubble strong').textContent).toBe('team');
        expect(host.querySelector('.chat-footer').className)
            .toBe('chat-footer opacity-50');
    });

    it('prefers rich named slots over shorthand attributes', async () => {
        const host = mount(`
            <div x-is="chat" avatar="/ignored.jpg" header="Ignored header"
                footer="Ignored footer" color="secondary">
                <div slot="image" data-image><span x-is="avatar">AK</span></div>
                <span slot="header"><strong>Anakin</strong> <time datetime="12:46">12:46</time></span>
                <article slot="bubble">I <em>hate</em> you!</article>
                <span slot="footer"><span>Seen</span></span>
            </div>
        `);
        await tick();

        expect(host.querySelector('[data-isas-generated="chat:avatar"]')).toBeNull();
        expect(host.querySelector('.chat-image [data-image]')).not.toBeNull();
        expect(host.querySelector('.chat-header strong').textContent).toBe('Anakin');
        expect(host.querySelector('.chat-header time').getAttribute('datetime')).toBe('12:46');
        expect(host.querySelector('.chat-bubble article em').textContent).toBe('hate');
        expect(host.querySelector('.chat-footer span').textContent).toBe('Seen');
        expect(host.textContent).not.toContain('Ignored');
    });

    it('escapes header and footer attributes and does not synthesize semantics', async () => {
        const host = mount(`
            <div x-is="chat"
                header="&lt;strong&gt;Not markup&lt;/strong&gt;"
                footer="&lt;time&gt;Not a time&lt;/time&gt;">Message</div>
        `);
        await tick();

        expect(host.querySelector('.chat-header strong')).toBeNull();
        expect(host.querySelector('.chat-footer time')).toBeNull();
        expect(host.querySelector('.chat-header').textContent)
            .toBe('<strong>Not markup</strong>');
        expect(host.querySelector('.chat-footer').textContent)
            .toBe('<time>Not a time</time>');
        expect(host.hasAttribute('role')).toBe(false);
        expect(host.hasAttribute('aria-live')).toBe(false);
        expect(host.hasAttribute('aria-label')).toBe(false);
    });

    it('supports placeholder and disabled Avatar shorthand values', async () => {
        const root = mount(`
            <div>
                <div id="placeholder" x-is="chat" avatar>Placeholder</div>
                <div id="disabled" x-is="chat" avatar="false">No image</div>
            </div>
        `);
        await tick();

        expect(root.querySelector('#placeholder .chat-image .avatar-placeholder')).not.toBeNull();
        expect(root.querySelector('#disabled .chat-image')).toBeNull();
    });

    it('preserves exact raw children and leaves child color consumer-owned', async () => {
        const host = mount(`
            <section x-is="chat" raw placement="end" color="error" class="authored">
                <aside class="chat-footer opacity-40" data-footer>First by choice</aside>
                <div class="chat-bubble chat-bubble-accent custom" data-bubble>
                    <strong>Raw bubble</strong>
                </div>
                <figure class="chat-image" data-image>Portrait</figure>
            </section>
        `);
        await tick();

        expect(host.className).toBe('chat chat-end authored');
        expect([...host.children].map((child) => child.getAttribute('data-footer') !== null
            ? 'footer'
            : child.getAttribute('data-bubble') !== null ? 'bubble' : 'image'))
            .toEqual(['footer', 'bubble', 'image']);
        expect(host.querySelector('[data-bubble]').className)
            .toBe('chat-bubble chat-bubble-accent custom');
        expect(host.querySelector('.chat-bubble-error')).toBeNull();
        expect(host.querySelector('[data-isas-slot]')).toBeNull();
    });

    it('rejects unsupported slots and mixed default and explicit bubble content', () => {
        expect(() => mount(`
            <div x-is="chat"><span slot="actions">Actions</span></div>
        `)).toThrow(
            "Component 'chat' does not support slot='actions'. Use 'image', 'header', 'bubble', or 'footer'.",
        );

        document.body.replaceChildren();

        expect(() => mount(`
            <div x-is="chat">
                Un-slotted message
                <span slot="bubble">Explicit message</span>
            </div>
        `)).toThrow(
            "Component 'chat' cannot mix un-slotted content with a 'bubble' slot.",
        );
    });

    it('keeps the generated Avatar and bubble stable across reactive content updates', async () => {
        const root = mount(`
            <div x-data="{ avatar: '/one.jpg', header: 'One', footer: 'Sent' }">
                <div x-is="chat" :avatar="avatar" :header="header" :footer="footer">
                    Stable message
                </div>
            </div>
        `);
        await tick();

        const host = root.querySelector('[x-is="chat"]');
        const avatar = host.querySelector('[x-is="avatar"]');
        const bubble = host.querySelector('.chat-bubble');

        Alpine.$data(root).avatar = '/two.jpg';
        Alpine.$data(root).header = 'Two';
        Alpine.$data(root).footer = 'Seen';
        await tick();

        expect(host.querySelector('[x-is="avatar"]')).toBe(avatar);
        expect(avatar.querySelector('img').getAttribute('src')).toBe('/two.jpg');
        expect(host.querySelector('.chat-bubble')).toBe(bubble);
        expect(host.querySelector('.chat-header').textContent).toBe('Two');
        expect(host.querySelector('.chat-footer').textContent).toBe('Seen');
    });

    it('reconciles Livewire-style source changes while preserving nested identity', async () => {
        const host = mount(`
            <div x-is="chat" placement="start" color="info" header="Support"
                avatar="/support.jpg" wire:key="message">
                <span x-is="badge" wire:key="message-badge">New</span>
                Initial message
            </div>
        `);
        await tick();

        const avatar = host.querySelector('[x-is="avatar"]');
        const badge = host.querySelector('[wire\\:key="message-badge"]');
        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'chat');
        incoming.setAttribute('placement', 'end');
        incoming.setAttribute('color', 'success');
        incoming.setAttribute('header', 'Customer success');
        incoming.setAttribute('footer', 'Seen');
        incoming.setAttribute('avatar', '/success.jpg');
        incoming.setAttribute('wire:key', 'message');
        incoming.innerHTML = `
            <span x-is="badge" wire:key="message-badge" color="success">Updated</span>
            Resolved message
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.classList.contains('chat-end')).toBe(true);
        expect(host.querySelector('.chat-bubble').classList.contains('chat-bubble-success'))
            .toBe(true);
        expect(host.querySelector('[x-is="avatar"]')).toBe(avatar);
        expect(avatar.querySelector('img').getAttribute('src')).toBe('/success.jpg');
        expect(host.querySelector('[wire\\:key="message-badge"]')).toBe(badge);
        expect(badge.textContent).toBe('Updated');
        expect(host.querySelector('.chat-bubble').textContent).toContain('Resolved message');
        expect(host.querySelector('.chat-footer').textContent).toBe('Seen');
    });

    it('restores the canonical authored tree on teardown', async () => {
        const host = mount(`
            <article x-is="chat" placement="end" avatar="/profile.jpg"
                header="Author" footer="Delivered" class="authored">
                Rich <strong>message</strong>
            </article>
        `);
        await tick();

        expect(host.querySelector('.chat-image')).not.toBeNull();
        Alpine.destroyTree(host);

        expect(host.className).toBe('authored');
        expect(host.children).toHaveLength(1);
        expect(host.firstElementChild.tagName).toBe('STRONG');
        expect(host.firstElementChild.textContent).toBe('message');
        expect(host.querySelector('.chat-bubble')).toBeNull();
        expect(host.getAttribute('header')).toBe('Author');
        expect(host.getAttribute('footer')).toBe('Delivered');
        expect(host.getAttribute('avatar')).toBe('/profile.jpg');
    });
});
