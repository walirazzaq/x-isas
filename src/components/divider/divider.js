import { Component } from '../../component.js';
import { hasVisibleContent, safeSlotText } from '../../support/html.js';

const HTML_VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

export class Divider extends Component {
    static scoped = false;
    static structural = true;

    prepareRender() {
        const isVoid = HTML_VOID_ELEMENTS.has(this.el.localName);

        if (isVoid) {
            return {
                isVoid,
                contentSource: 'void',
            };
        }

        let contentSource = 'authored';

        if (!hasVisibleContent(this.slots.get('default'))) {
            const label = this.attrs.has('label')
                ? String(this.attrs.get('label') ?? '')
                : '';

            contentSource = label ? 'label' : 'empty';
            this.slots.set('default', safeSlotText(label));
        }

        return {
            isVoid,
            contentSource,
        };
    }

    render() {
        if (this.view.isVoid) return undefined;
        return this.slots.get('default').html();
    }
}
