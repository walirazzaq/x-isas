import { Component } from '../../component.js';
import { escapeHtml, renderElement, visibleNodes } from '../../support/html.js';
import { Part } from '../../support/part.js';
import { resolveError } from '../input/input.js';
import { NestedScopeBridge } from './nested-scope-bridge.js';

const REGION_NAMES = Object.freeze(['label', 'control', 'support', 'error']);
const FIELD_SIZES = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl']);
let nextFieldId = 0;

export function contentAttribute(attributes, name) {
    if (!attributes.has(name)) return '';
    const value = attributes.get(name);
    if (value === true || value === false || value === null || value === undefined) return '';
    return escapeHtml(String(value));
}

export function validValue(value) {
    return value !== null
        && value !== undefined
        && value !== true
        && value !== false
        && String(value).trim() !== '';
}

export function componentName(expression) {
    return String(expression ?? '').trim().split(':', 1)[0];
}

export function appendTokens(value, tokens) {
    return [...new Set([
        ...String(value ?? '').split(/\s+/).filter(Boolean),
        ...tokens.filter(Boolean),
    ])].join(' ');
}

export class FieldShell extends Component {
    static structural = true;

    static fieldName = 'field';
    static controlName = '';
    static controlMarker = '';
    static scopeAlias = '';
    static scopeProperty = '';
    static safeMethods = [];
    static scopeFallbacks = {};

    static parts = {
        label: {
            tag: 'label',
            render: ({ component, part }) => component.renderMetadata(part, 'label'),
        },
        control: {
            tag: 'div',
            render: ({ component, part }) => component.renderControl(part),
        },
        support: {
            tag: 'small',
            render: ({ component, part }) => component.renderMetadata(part, 'support'),
        },
        error: {
            tag: 'small',
            render: ({ component, part }) => component.renderError(part),
        },
    };

    mount() {
        this.fieldSequence = ++nextFieldId;
        this.scopeBridge = new NestedScopeBridge(this, {
            alias: this.constructor.scopeAlias,
            componentName: this.constructor.controlName,
            safeMethods: this.constructor.safeMethods,
            fallbacks: this.constructor.scopeFallbacks,
        });
        this.scopeSyncToken = 0;
    }

    mergeScope() {
        const component = this;
        return Object.defineProperty({}, this.constructor.scopeProperty, {
            enumerable: true,
            get: () => component.scopeBridge.proxy,
        });
    }

    layout(attributes = this.attrs) {
        const value = String(attributes?.get('layout') ?? 'stacked').toLowerCase();
        return ['stacked', 'inline'].includes(value) ? value : 'stacked';
    }

    size(attributes = this.attrs) {
        const value = String(attributes?.get('size') ?? 'md').toLowerCase();
        return FIELD_SIZES.includes(value) ? value : 'md';
    }

    fieldError() {
        return resolveError(this.attrs);
    }

    prepareRender() {
        const authored = REGION_NAMES.flatMap((name) => this.parts.all(name));
        const custom = authored.length > 0;

        for (const name of REGION_NAMES) {
            if (this.parts.all(name).length > 1) {
                throw new Error(
                    `Component '${this.constructor.fieldName}' allows only one x-part='${name}'.`,
                );
            }
        }
        if (custom && !this.parts.has('control')) {
            throw new Error(
                `Component '${this.constructor.fieldName}' custom composition requires one x-part='control'.`,
            );
        }

        const error = this.fieldError();
        if (!custom) this.generateDefaultParts(error);

        this.controlPart = this.parts.first('control');
        this.controlSource = this.controlElement(this.controlPart);
        this.ids = this.resolveIds(this.controlSource);
        this.prepareRegionAttributes(error);
        this.controlAttributes = this.buildControlAttributes(this.controlSource, error);
        this.applyControlAccessibility(this.controlSource, this.controlAttributes, error);

        return {
            layout: this.layout(),
            custom,
            error,
        };
    }

    generateDefaultParts(error) {
        const definitions = [
            ['label', Boolean(contentAttribute(this.attrs, 'label'))],
            ['control', true],
            ['support', Boolean(contentAttribute(this.attrs, 'support'))],
            ['error', this.shouldGenerateErrorPart(error)],
        ];

        definitions.forEach(([name, include], position) => {
            if (!include) return;
            this.parts.add(Part.generated(name, {
                descriptor: this.runtime.partDescriptors.get(name),
                position,
                attrs: this.attrs.for(name),
            }));
        });
    }

    shouldGenerateErrorPart(error) {
        return Boolean(error.message);
    }

    prepareRegionAttributes(error) {
        for (const name of REGION_NAMES) {
            const part = this.parts.first(name);
            if (!part) continue;

            let attrs = part.attrs.set(`data-isas-${this.constructor.fieldName}-${name}`, '');
            if (name === 'label' && !attrs.has('for') && !attrs.has(':for')) {
                attrs = this.ids.control.type === 'dynamic'
                    ? attrs.set(':for', this.ids.control.value)
                    : attrs.set('for', this.ids.control.value);
            }
            if (name === 'support' && !attrs.has('id')) attrs = attrs.set('id', this.ids.support);
            if (name === 'error') {
                if (!attrs.has('id')) attrs = attrs.set('id', this.ids.error);
                attrs = attrs
                    .set('aria-live', attrs.get('aria-live') ?? 'polite')
                    .set('hidden', !error.active);
            }
            this.parts.replace(Object.assign(part, { attrs }));
        }
        this.controlPart = this.parts.first('control');
    }

    controlElement(part) {
        if (!part) return null;
        const nodes = visibleNodes(part.slots.get('default'));
        if (nodes.length === 0) return null;
        if (nodes.length !== 1
            || nodes[0].nodeType !== Node.ELEMENT_NODE
            || componentName(nodes[0].getAttribute('x-is')) !== this.constructor.controlName) {
            throw new Error(
                `Component '${this.constructor.fieldName}' x-part='control' must be empty or contain exactly one x-is='${this.constructor.controlName}' element.`,
            );
        }
        return nodes[0];
    }

    regionIds(control, preferredBase = null) {
        const base = preferredBase ?? `x-isas-${this.constructor.fieldName}-${this.fieldSequence}`;
        const support = this.parts.first('support')?.attrs.get('id') || `${base}-support`;
        const error = this.parts.first('error')?.attrs.get('id') || `${base}-error`;
        return { control, support, error };
    }

    renderMetadata(part, name) {
        const pieces = [];
        const prepend = part.slots.get('prepend');
        const append = part.slots.get('append');
        const main = part.slots.get('default');

        if (prepend.filled()) {
            pieces.push(renderElement('span', part.attrs.for('prepend'), prepend.html()));
        } else if (validValue(part.attrs.get('prepend'))) {
            pieces.push(renderElement(
                'span',
                part.attrs.for('prepend'),
                escapeHtml(part.attrs.get('prepend')),
            ));
        }

        const content = main.filled() ? main.html() : contentAttribute(this.attrs, name);
        if (content) pieces.push(renderElement('span', part.attrs.for('content'), content));

        if (append.filled()) {
            pieces.push(renderElement('span', part.attrs.for('append'), append.html()));
        } else if (validValue(part.attrs.get('append'))) {
            pieces.push(renderElement(
                'span',
                part.attrs.for('append'),
                escapeHtml(part.attrs.get('append')),
            ));
        }
        return pieces.join('');
    }

    renderError(part) {
        return part.slots.get('default').filled()
            ? part.slots.get('default').html()
            : escapeHtml(this.view.error.message);
    }

    generatedControlTag() {
        return 'div';
    }

    generatedControlContent() {
        return '';
    }

    renderControl(part) {
        const authored = this.controlSource ?? this.controlElement(part);
        if (!authored) {
            return renderElement(
                this.generatedControlTag(),
                this.controlAttributes,
                this.generatedControlContent(),
            );
        }

        const clone = authored.cloneNode(true);
        const merged = this.mergeAuthoredControlAttributes(clone, this.controlAttributes);
        for (const { name } of [...clone.attributes]) clone.removeAttribute(name);
        for (const [name, value] of merged.entries()) {
            if (value !== false && value !== null && value !== undefined) {
                clone.setAttribute(name, value === true ? '' : String(value));
            }
        }
        return clone.outerHTML;
    }

    mergeAuthoredControlAttributes() {
        throw new Error('Field controls must implement mergeAuthoredControlAttributes().');
    }

    render() {
        const html = this.parts.ordered().map((part) => part.html(this)).join('');
        this.queueScopeSync();
        return html;
    }

    queueScopeSync() {
        const token = ++this.scopeSyncToken;
        queueMicrotask(() => queueMicrotask(() => {
            if (token !== this.scopeSyncToken || !this.el.isConnected) return;
            const nested = this.el.querySelector(`[${this.constructor.controlMarker}]`);
            if (!this.scopeBridge.connect(nested)) {
                queueMicrotask(() => {
                    if (token === this.scopeSyncToken && this.el.isConnected) {
                        this.scopeBridge.connect(nested);
                    }
                });
            }
        }));
    }

    buildControlAttributes() {
        throw new Error('Field controls must implement buildControlAttributes().');
    }

    resolveIds() {
        throw new Error('Field controls must implement resolveIds().');
    }

    applyControlAccessibility() {}

    destroy() {
        this.scopeSyncToken += 1;
        this.scopeBridge?.destroy();
    }
}
