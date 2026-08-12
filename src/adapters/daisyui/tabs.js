import { tabHasAccessories } from '../../components/tabs/tabs.js';

const VARIANT_CLASSES = Object.freeze({
    box: 'tabs-box',
    border: 'tabs-border',
    lift: 'tabs-lift',
});

const PLACEMENT_CLASSES = Object.freeze({
    top: 'tabs-top',
    bottom: 'tabs-bottom',
});

const SIZE_CLASSES = Object.freeze({
    xs: 'tabs-xs',
    sm: 'tabs-sm',
    md: 'tabs-md',
    lg: 'tabs-lg',
    xl: 'tabs-xl',
});

export function tabsAdapter({ component, attrs, parts }) {
    const managed = parts.has('tab-content') || component.controller?.linked;

    return {
        host: {
            class: [
                'tabs',
                VARIANT_CLASSES[String(attrs.get('variant') ?? '').toLowerCase()] ?? '',
                PLACEMENT_CLASSES[String(attrs.get('placement') ?? '').toLowerCase()] ?? '',
                SIZE_CLASSES[String(attrs.get('size') ?? '').toLowerCase()] ?? '',
            ],
        },
        parts: {
            tab: ({ attrs: tabAttrs, slots }) => {
                const composed = tabHasAccessories(tabAttrs, slots);

                return {
                    host: {
                        class: [
                            'tab',
                            !managed && tabAttrs.boolean('active') ? 'tab-active' : '',
                            tabAttrs.boolean('disabled')
                                || String(tabAttrs.get('aria-disabled')).toLowerCase() === 'true'
                                ? 'tab-disabled'
                                : '',
                        ],
                    },
                    parts: composed ? {
                        prepend: { class: 'me-2 inline-flex shrink-0 items-center gap-2' },
                        append: { class: 'ms-2 inline-flex shrink-0 items-center gap-2' },
                        icon: { class: 'shrink-0' },
                        'icon-end': { class: 'shrink-0' },
                    } : {},
                };
            },
            'tab-content': { class: 'tab-content' },
        },
    };
}
