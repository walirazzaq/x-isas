import { describe, expect, it } from 'vitest';
import {
    Component,
    ComponentRegistry,
    AttributeBag,
    AdapterRegistry,
    normalizeAttachmentSpec,
    parseComponentSpec,
} from '../src/index.js';

describe('registries and declarations', () => {
    it('normalizes registrations and falls back for unknown components', () => {
        class TestComponent extends Component {}
        const registry = new ComponentRegistry();

        registry.register('Notice_Item', TestComponent);
        expect(registry.get('noticeItem')).toBe(TestComponent);
        expect(registry.resolve('missing')).toMatchObject({
            name: 'missing',
            Class: Component,
            registered: false,
        });
    });

    it('rejects conflicting and invalid component registrations', () => {
        class First extends Component {}
        class Second extends Component {}
        const registry = new ComponentRegistry();
        registry.register('first', First);

        expect(() => registry.register('first', Second)).toThrow("Component 'first' is already registered.");
        expect(() => registry.register('second', First)).toThrow("already registered as 'first'");
        expect(() => registry.register('plain', class {})).toThrow('must extend Component');
        expect(() => registry.ensure('missing')).toThrow("Component 'missing' is not registered.");
    });

    it('registers one replaceable adapter per normalized component name', () => {
        const first = () => ({ host: { class: 'first' } });
        const second = {
            attributes: () => ({ host: { class: 'second' } }),
            render: () => '<span>second</span>',
        };
        const registry = new AdapterRegistry();

        expect(registry.register('Notice_Item', first)).toBe(registry);
        expect(registry.get('noticeItem')).toBe(first);
        expect(registry.has('notice-item')).toBe(true);
        expect(registry.entries()).toEqual([['notice-item', first]]);
        expect(registry.register('notice-item', first)).toBe(registry);
        expect(() => registry.register('notice-item', second))
            .toThrow("Adapter 'notice-item' is already registered.");

        registry.register('notice-item', second, { replace: true });
        expect(registry.get('notice-item')).toBe(second);
        expect(() => registry.register('', first)).toThrow('non-empty component name');
        expect(() => registry.register('plain', {}))
            .toThrow("Adapter 'plain' descriptor requires an attributes or render function.");
    });

    it('validates attributes-only, render-only, and combined adapter descriptors', () => {
        const attributes = { attributes: () => ({ host: { class: 'presented' } }) };
        const render = { render: () => '<span>custom</span>' };
        const combined = { ...attributes, ...render };
        const registry = new AdapterRegistry();

        registry.register('attributes-only', attributes);
        registry.register('render-only', render);
        registry.register('combined', combined);
        expect(registry.register('combined', combined)).toBe(registry);

        expect(registry.entries()).toEqual([
            ['attributes-only', attributes],
            ['render-only', render],
            ['combined', combined],
        ]);
        expect(() => registry.register('invalid-attributes', { attributes: true }))
            .toThrow('descriptor attributes must be a function');
        expect(() => registry.register('invalid-render', { render: 'markup' }))
            .toThrow('descriptor render must be a function');
        expect(() => registry.register('array', []))
            .toThrow('must be a function or a descriptor object');
        expect(() => registry.register('null', null))
            .toThrow('must be a function or a descriptor object');
    });

    it('normalizes string, array, and object x-as declarations', () => {
        class First extends Component { static attachable = true; }
        class Second extends Component { static attachable = true; }
        const registry = new ComponentRegistry();
        registry.register('first', First).register('second', Second);

        const literal = normalizeAttachmentSpec('first', registry);
        expect(literal[0]).toMatchObject({
            name: 'first', namespace: '$first', Class: First, config: {}, scoped: true,
        });
        expect(normalizeAttachmentSpec(['first', 'second'], registry).map(({ name }) => name))
            .toEqual(['first', 'second']);

        const source = { 'first:custom': { enabled: true }, second: {} };
        const result = normalizeAttachmentSpec(source, registry);
        expect(result.map(({ name, namespace, config }) => ({ name, namespace, config }))).toEqual([
            { name: 'first', namespace: 'custom', config: { enabled: true } },
            { name: 'second', namespace: '$second', config: {} },
        ]);
        expect(result[0].config).not.toBe(source['first:custom']);
        expect(Object.isFrozen(result[0].config)).toBe(true);
        expect(normalizeAttachmentSpec('first', registry, false)[0].scoped).toBe(false);
        expect(() => normalizeAttachmentSpec({ first: true }, registry)).toThrow('plain configuration object');
        expect(() => normalizeAttachmentSpec([true], registry)).toThrow('non-empty component specifications');
        expect(() => normalizeAttachmentSpec(['first', 'first:again'], registry)).toThrow('more than once');
        expect(() => normalizeAttachmentSpec(['first:same', 'second:same'], registry)).toThrow('already in use');
    });

    it('rejects non-attachable components and the reserved host namespace', () => {
        class Structural extends Component {}
        class Functional extends Component { static attachable = true; }
        const registry = new ComponentRegistry();
        registry.register('structural', Structural).register('functional', Functional);

        expect(() => normalizeAttachmentSpec('structural', registry)).toThrow('not attachable');
        expect(() => normalizeAttachmentSpec('functional:$host', registry)).toThrow('reserved');
        expect(() => parseComponentSpec('anything:$host', registry)).toThrow('reserved');
    });

    it('parses default and explicit component namespaces', () => {
        const registry = new ComponentRegistry();

        expect(parseComponentSpec('notice-item', registry)).toMatchObject({
            name: 'notice-item', namespace: '$noticeItem', registered: false,
        });
        expect(parseComponentSpec('button:action', registry).namespace).toBe('action');
        expect(parseComponentSpec('button:$action', registry).namespace).toBe('$action');
        expect(parseComponentSpec('unknown:scope', registry)).toMatchObject({
            name: 'unknown', namespace: 'scope', registered: false,
        });
        expect(() => parseComponentSpec('button:my-scope', registry)).toThrow('valid JavaScript identifier');
        expect(() => parseComponentSpec('button:', registry)).toThrow('valid JavaScript identifier');
        expect(() => parseComponentSpec('', registry)).toThrow('literal component name');
    });

    it('merges class and style attributes while preserving authored values', () => {
        const attributes = AttributeBag.from({
            class: 'authored shared',
            style: 'color: red',
            title: 'authored',
        }).merge({
            class: 'base shared',
            style: 'display: block',
            title: 'default',
            disabled: true,
        });

        expect(attributes.get('class')).toBe('base shared authored');
        expect(attributes.get('style')).toBe('display: block; color: red');
        expect(attributes.get('title')).toBe('authored');
        expect(attributes.toString()).toContain('disabled');
    });
});
