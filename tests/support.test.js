import { describe, expect, it, vi } from 'vitest';
import { AttributeBag } from '../src/support/attribute-bag.js';
import { hasComponentDirective } from '../src/support/directives.js';
import {
    escapeHtml,
    hasVisibleContent,
    renderElement,
    safeSlotText,
    serializeNode,
    serializeNodes,
    setAttributeIfChanged,
    setAttributes,
    visibleNodes,
} from '../src/support/html.js';
import { camelCase, isPlainObject } from '../src/support/value.js';

describe('shared support utilities', () => {
    it('escapes generated text and renders ordinary and opening-only elements', () => {
        const attrs = new AttributeBag({ class: 'example', hidden: true });

        expect(escapeHtml(`<strong title="'">&</strong>`))
            .toBe('&lt;strong title=&quot;&#39;&quot;&gt;&amp;&lt;/strong&gt;');
        expect(safeSlotText('<strong>'))
            .toBe('&amp;lt;strong&amp;gt;');
        expect(renderElement('span', attrs, 'Content'))
            .toBe('<span class="example" hidden>Content</span>');
        expect(renderElement('img', attrs, null))
            .toBe('<img class="example" hidden>');
    });

    it('serializes source nodes without changing their authored representation', () => {
        const template = document.createElement('template');
        template.innerHTML = 'Text<!-- note --><strong>Value</strong>';
        const nodes = [...template.content.childNodes];

        expect(serializeNode(nodes[1])).toBe('<!-- note -->');
        expect(serializeNodes(nodes)).toBe('Text<!-- note --><strong>Value</strong>');
    });

    it('distinguishes visually meaningful nodes from whitespace and comments', () => {
        const empty = document.createElement('template');
        empty.innerHTML = ' \n <!-- note -->';
        const filled = document.createElement('template');
        filled.innerHTML = ' \n <!-- note --><span></span>';

        expect(hasVisibleContent(empty)).toBe(false);
        expect(hasVisibleContent(filled)).toBe(true);
        expect(visibleNodes(filled)).toHaveLength(1);
        expect(visibleNodes(filled)[0].localName).toBe('span');
    });

    it('updates DOM attributes only when their normalized value changes', () => {
        const element = document.createElement('div');
        element.setAttribute('data-state', 'ready');
        const setter = vi.spyOn(element, 'setAttribute');

        setAttributeIfChanged(element, 'data-state', 'ready');
        expect(setter).not.toHaveBeenCalled();

        setAttributes(element, new AttributeBag({
            'data-state': 'done',
            disabled: true,
            hidden: false,
        }));
        expect(element.getAttribute('data-state')).toBe('done');
        expect(element.getAttribute('disabled')).toBe('');
        expect(element.hasAttribute('hidden')).toBe(false);
    });

    it('shares plain-object, naming, and component-directive semantics', () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
        expect(camelCase('max-selection-shown')).toBe('maxSelectionShown');

        const component = document.createElement('div');
        component.setAttribute('x-is.unscoped', 'button');
        expect(hasComponentDirective(component)).toBe(true);

        const attachment = document.createElement('div');
        attachment.setAttribute('x-as', 'option');
        expect(hasComponentDirective(attachment)).toBe(false);
    });
});
