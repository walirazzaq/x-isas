import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import isas, {
    Card,
    Component,
    HostRuntime,
    Isas,
    Part,
    PartBag,
    cardAdapter,
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

describe('shallow parts', () => {
    it('exports the part extension values', () => {
        expect(Part).toBeTypeOf('function');
        expect(PartBag).toBeTypeOf('function');
    });

    it('scopes nested slots and applies per-occurrence reactive presentation', async () => {
        class TestPanel extends Component {
            static structural = true;
            static parts = {
                body: {
                    render({ slots }) {
                        return `${slots.get('title').html()}${slots.get('default').html()}`;
                    },
                },
            };

            prepareRender() {
                return {
                    rootSlots: this.slots.names(),
                    bodySlots: this.parts.first('body').slots.names(),
                };
            }

            render() {
                return this.parts.ordered().map((part) => part.html(this)).join('');
            }
        }

        Isas.components.register('test-shallow-panel', TestPanel);
        Isas.adapters.register('test-shallow-panel', () => ({
            parts: {
                body: ({ attrs }) => ({
                    host: {
                        class: attrs.boolean('compact') ? 'panel-body compact' : 'panel-body',
                        style: attrs.boolean('compact') ? '--panel-gap: 0.25rem' : null,
                    },
                    slots: { title: { class: 'panel-title' } },
                }),
            },
        }));

        const root = mount(`
            <div x-data="{ dense: false }">
                <article x-is="test-shallow-panel" body:class="root-body"
                    body:title:class="root-title">
                    <section x-part="body" :compact="dense" class="authored-body"
                        title:class="local-title">
                        <h2 slot="title" class="authored-title">Title</h2>
                        <p>Copy</p>
                    </section>
                </article>
                <button @click="dense = ! dense">Toggle</button>
            </div>
        `);
        await tick();

        const host = root.querySelector('article');
        const body = host.querySelector('[x-part="body"]');
        const title = body.querySelector('h2');
        expect(body.className).toBe('panel-body root-body authored-body');
        expect(title.className).toBe('panel-title root-title local-title authored-title');
        expect(title.hasAttribute('slot')).toBe(false);
        expect(HostRuntime.from(host).component.view).toEqual({
            rootSlots: [],
            bodySlots: ['title', 'default'],
        });

        root.querySelector('button').click();
        await tick();
        expect(root.querySelector('[x-part="body"]')).toBe(body);
        expect(body.hasAttribute('compact')).toBe(true);
        expect(body.classList.contains('compact')).toBe(true);
        expect(body.style.getPropertyValue('--panel-gap')).toBe('0.25rem');

        root.querySelector('button').click();
        await tick();
        expect(body.classList.contains('compact')).toBe(false);
        expect(body.classList.contains('authored-body')).toBe(true);
        expect(body.style.getPropertyValue('--panel-gap')).toBe('');
    });

    it('keeps repeated occurrences ordered and independently processed', async () => {
        class TestRepeated extends Component {
            static structural = true;
            static parts = {
                item: {
                    prepare: ({ attrs, index }) => ({ index, tone: attrs.get('tone') }),
                    render: ({ attrs, slots, view }) => `<span ${attrs.for('content')}
                        data-index="${view.index}" data-tone="${view.tone}">
                        ${slots.get('default').html()}</span>`,
                },
            };
            render() { return this.parts.ordered().map((part) => part.html(this)).join(''); }
        }

        Isas.components.register('test-repeated-parts', TestRepeated);
        Isas.adapters.register('test-repeated-parts', () => ({
            parts: {
                item: ({ attrs, index }) => ({
                    host: { class: `item-${index} tone-${attrs.get('tone')}` },
                    parts: {
                        content: {
                            class: 'processed-content',
                            'data-processed-tone': attrs.get('tone'),
                        },
                    },
                }),
            },
        }));

        const host = mount(`
            <div x-is="test-repeated-parts" item:content:class="parent-content">
                <section x-part="item" tone="first" content:class="local-content">One</section>
                <aside x-part="item" tone="second">Two</aside>
            </div>
        `);
        await tick();

        const items = host.querySelectorAll(':scope > [x-part="item"]');
        expect(items).toHaveLength(2);
        expect(items[0].localName).toBe('section');
        expect(items[0].classList.contains('item-0')).toBe(true);
        expect(items[0].firstElementChild.classList.contains('processed-content')).toBe(true);
        expect(items[0].firstElementChild.classList.contains('parent-content')).toBe(true);
        expect(items[0].firstElementChild.classList.contains('local-content')).toBe(true);
        expect(items[0].firstElementChild.dataset.processedTone).toBe('first');
        expect(items[1].localName).toBe('aside');
        expect(items[1].classList.contains('tone-second')).toBe(true);
        expect(items[1].firstElementChild.dataset.index).toBe('1');
        expect(items[1].firstElementChild.dataset.tone).toBe('second');
    });

    it('uses prepared scoped slots for a descriptor default render', async () => {
        class TestDefaultPart extends Component {
            static structural = true;
            static parts = {
                region: {
                    prepare({ slots }) {
                        slots.setDefault('default', '<em class="fallback">Fallback</em>');
                    },
                },
            };
            render() { return this.parts.ordered().map((part) => part.html(this)).join(''); }
        }

        Isas.components.register('test-default-part', TestDefaultPart);
        Isas.adapters.register('test-default-part', () => ({
            parts: { region: { slots: { label: { class: 'processed-label' } } } },
        }));

        const host = mount(`
            <div x-is="test-default-part">
                <section x-part="region"><strong slot="label">Label</strong><p>Copy</p></section>
                <aside x-part="region"></aside>
            </div>
        `);
        await tick();

        expect(host.querySelector('strong').className).toBe('processed-label');
        expect(host.querySelector('section').textContent).toBe('LabelCopy');
        expect(host.querySelector('aside .fallback')).not.toBeNull();
    });

    it.each([
        ['<section x-part="missing"></section>', "does not declare part 'missing'"],
        ['<section x-part="body"><i x-part="body"></i></section>', 'nested x-part'],
        ['<div><section x-part="body"></section></div>', 'only allows x-part on direct children'],
        ['<div x-as="option"><section x-part="body"></section></div>', 'only allows x-part on direct children'],
        ['<section x-part="body" slot="body"></section>', 'cannot also declare slot'],
        ['<section x-part="body" x-is="button"></section>', 'cannot also declare x-is'],
        ['<section x-part="body" x-as="button"></section>', 'cannot also declare x-as'],
        ['<section :x-part="name"></section>', 'names must be literal'],
    ])('rejects invalid part markup', (children, message) => {
        expect(() => mount(`<article x-is="card">${children}</article>`)).toThrow(message);
    });

    it.each(['x-is', 'x-is.scoped', 'x-is.unscoped'])(
        'treats a direct nested %s host as a part ownership boundary',
        async (directive) => {
            const host = mount(`
                <div x-is="test-part-boundary-owner">
                    <ul ${directive}="menu">
                        <li x-part="item" label="Nested item"></li>
                    </ul>
                </div>
            `);
            await tick();

            const menu = host.querySelector('[x-part="item"]').parentElement;
            expect(HostRuntime.from(host).component.name).toBe('test-part-boundary-owner');
            expect(HostRuntime.from(menu).component.name).toBe('menu');
            expect(menu.classList.contains('menu')).toBe(true);
            expect(menu.querySelector(':scope > [x-part="item"] button').textContent)
                .toBe('Nested item');
        },
    );

    it('reconciles repeated keyed parts and preserves nested component runtimes', async () => {
        const host = mount(`
            <article x-is="card">
                <section x-part="body" wire:key="primary-body">
                    <h2 slot="title">Initial</h2>
                    <span x-is="badge" color="primary">1</span>
                </section>
            </article>
        `);
        await tick();

        const body = host.querySelector('[wire\\:key="primary-body"]');
        const badge = host.querySelector('[x-is="badge"]');
        const incoming = document.createElement('article');
        incoming.setAttribute('x-is', 'card');
        incoming.innerHTML = `
            <section x-part="body" wire:key="primary-body">
                <h2 slot="title">Updated</h2>
                <span x-is="badge" color="secondary">2</span>
            </section>
            <aside x-part="body" wire:key="secondary-body">
                <h2 slot="title">Second</h2>
            </aside>
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(host.querySelector('[wire\\:key="primary-body"]')).toBe(body);
        expect(host.querySelector('[x-is="badge"]')).toBe(badge);
        expect(badge.classList.contains('badge-secondary')).toBe(true);
        expect(badge.textContent).toBe('2');
        expect(host.querySelectorAll(':scope > [x-part="body"]')).toHaveLength(2);
        expect(host.textContent).toContain('Updated');
        expect(host.textContent).toContain('Second');

        const removal = document.createElement('article');
        removal.setAttribute('x-is', 'card');
        removal.innerHTML = `
            <section x-part="body" wire:key="primary-body">
                <h2 slot="title">Final</h2>
                <span x-is="badge" color="secondary">3</span>
            </section>
        `;
        expect(HostRuntime.from(host).reconcileFrom(removal)).toBe(true);
        await tick();
        expect(host.querySelector('[wire\\:key="primary-body"]')).toBe(body);
        expect(host.querySelectorAll(':scope > [x-part="body"]')).toHaveLength(1);
        expect(host.textContent).toContain('Final');
        expect(host.textContent).not.toContain('Second');
    });

    it('preserves a nested Livewire island while its owning part is reconciled', async () => {
        const host = mount(`
            <article x-is="card" variant="border">
                <section x-part="body" wire:key="primary-body">
                    <h2 slot="title">Revision 0</h2>
                    <div wire:id="nested-card-counter" wire:key="card-nested-counter">
                        <span data-nested-count>4</span>
                        <button x-is="button" icon="i-tabler-plus" wire:click="increment">
                            Increment child
                            <span x-is="badge" slot="append">4</span>
                        </button>
                    </div>
                </section>
            </article>
        `);
        await tick();

        const body = host.querySelector('[wire\\:key="primary-body"]');
        const island = host.querySelector('[wire\\:id="nested-card-counter"]');
        const childButton = island.querySelector('[wire\\:click="increment"]');
        const childRuntime = HostRuntime.from(childButton);
        const canonicalChildSource = childRuntime.source.outerHTML();

        for (const revision of [1, 2]) {
            const incoming = document.createElement('article');
            incoming.setAttribute('x-is', 'card');
            incoming.setAttribute('variant', 'border');
            incoming.innerHTML = `
                <section x-part="body" wire:key="primary-body" data-revision="${revision}">
                    <h2 slot="title">Revision ${revision}</h2>
                    ${island.cloneNode(true).outerHTML}
                </section>
                ${revision === 1 ? '<aside x-part="body" wire:key="details-body">Details</aside>' : ''}
            `;

            expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
            await tick();

            const preservedBody = host.querySelector('[wire\\:key="primary-body"]');
            const preservedIsland = host.querySelector('[wire\\:id="nested-card-counter"]');
            expect(preservedBody).toBe(body);
            expect(preservedBody.getAttribute('data-revision')).toBe(String(revision));
            expect(preservedIsland).toBe(island);
            expect(preservedIsland.querySelector('[data-nested-count]').textContent).toBe('4');
            expect(preservedIsland.querySelector('[wire\\:click="increment"]')).toBe(childButton);
            expect(childRuntime.source.outerHTML()).toBe(canonicalChildSource);
            expect(childButton.querySelectorAll('.i-tabler-plus')).toHaveLength(1);
            expect(childButton.querySelectorAll('[x-is="badge"]')).toHaveLength(1);
            expect(host.querySelector('h2').textContent).toBe(`Revision ${revision}`);
            expect(host.querySelectorAll(':scope > [x-part="body"]')).toHaveLength(revision === 1 ? 2 : 1);
        }
    });

    it('restores the canonical authored part tree on teardown', async () => {
        const host = mount(`
            <article x-is="card" variant="border">
                <section x-part="body"><h2 slot="title">Title</h2><p>Copy</p></section>
            </article>
        `);
        await tick();
        expect(host.classList.contains('card-border')).toBe(true);
        expect(host.querySelector('h2').hasAttribute('slot')).toBe(false);

        Alpine.destroyTree(host);
        expect(host.className).toBe('');
        expect(host.firstElementChild.getAttribute('x-part')).toBe('body');
        expect(host.querySelector('h2').getAttribute('slot')).toBe('title');
        expect(host.firstElementChild.hasAttribute('class')).toBe(false);
    });
});

describe('card component', () => {
    it('is registered with its adapter', () => {
        expect(Isas.components.get('card')).toBe(Card);
        expect(Isas.adapters.get('card')).toBe(cardAdapter);
    });

    it('renders figures and scoped body slots with common modifiers', async () => {
        const host = mount(`
            <article x-is="card" size="lg" variant="border" side image-full class="explicit">
                <figure slot="figure"><img src="start.png" alt="Start"></figure>
                <section x-part="body" class="body-explicit">
                    <h2 slot="title" class="title-explicit">Card title</h2>
                    <p>Card copy</p>
                    <footer slot="actions" class="actions-explicit"><button>Act</button></footer>
                </section>
                <figure slot="figure-end"><img src="end.png" alt="End"></figure>
            </article>
        `);
        await tick();

        expect(host.className).toBe('card card-lg card-border card-side image-full explicit');
        expect(host.children[0].querySelector('img').getAttribute('src')).toBe('start.png');
        expect(host.children[1].matches('section[x-part="body"]')).toBe(true);
        expect(host.children[1].className).toBe('card-body body-explicit');
        expect(host.querySelector('h2').className).toBe('card-title title-explicit');
        expect(host.querySelector('footer').className).toBe('card-actions actions-explicit');
        expect(host.children[2].querySelector('img').getAttribute('src')).toBe('end.png');
    });

    it('lets nested real components own their direct parts', async () => {
        const host = mount(`
            <article x-is="card">
                <section x-part="body">
                    <h2 slot="title">Outer</h2>
                    <article x-is="card" variant="dash">
                        <div x-part="body"><h3 slot="title">Inner</h3></div>
                    </article>
                </section>
            </article>
        `);
        await tick();

        const inner = host.querySelector('article[x-is="card"]');
        expect(host.classList.contains('card')).toBe(true);
        expect(inner.classList.contains('card-dash')).toBe(true);
        expect(inner.querySelector(':scope > [x-part="body"] h3').classList.contains('card-title'))
            .toBe(true);
    });

    it('supports legacy, mixed, and repeated body rendering', async () => {
        const host = mount(`
            <article x-is="card">
                <section x-part="body"><h2 slot="title">First</h2></section>
                <h2 slot="title">Legacy</h2>
                <p>Legacy copy</p>
                <section x-part="body"><h2 slot="title">Last</h2></section>
            </article>
        `);
        await tick();

        expect([...host.querySelectorAll(':scope > .card-body')].map((body) => body.textContent.trim()))
            .toEqual(['First', 'LegacyLegacy copy', 'Last']);

    });

    it('does not synthesize a legacy body for Livewire conditional markers', async () => {
        const host = mount(`
            <article x-is="card">
                <!--[if BLOCK]><![endif]-->
                <section x-part="body"><h2 slot="title">Only body</h2></section>
                <!--[if ENDBLOCK]><![endif]-->
            </article>
        `);
        await tick();
        expect(host.querySelectorAll(':scope > .card-body')).toHaveLength(1);
        expect(host.querySelectorAll(':scope > [x-part="body"]')).toHaveLength(1);
    });

    it('exposes prepared parts to a replacement Card renderer', async () => {
        Isas.adapters.register('card', {
            attributes: cardAdapter,
            render({ parts }) {
                return `<p class="replacement-marker" data-parts="${parts.ordered().length}"></p>`
                    + parts.ordered().map((part) => part.html()).join('');
            },
        }, { replace: true });

        try {
            const host = mount(`
                <article x-is="card"><section x-part="body"><p>Custom</p></section></article>
            `);
            await tick();
            expect(host.classList.contains('card')).toBe(true);
            expect(host.querySelector('.replacement-marker').dataset.parts).toBe('1');
            expect(host.querySelector('[x-part="body"]').classList.contains('card-body')).toBe(true);
            expect(host.textContent).toBe('Custom');
        } finally {
            Isas.adapters.register('card', cardAdapter, { replace: true });
        }
    });
});
