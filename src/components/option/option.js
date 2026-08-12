import { Component } from '../../component.js';
import { generatedComponentAttributes } from '../../support/generated-component.js';
import { escapeHtml, renderElement } from '../../support/html.js';
import { StyledOptionPresentation } from './styled-option-presentation.js';

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export class Option extends Component {
    static attachable = true;
    static structural = true;

    mount() {
        this.selectOwner = null;
        this.ownerErrorReported = false;
        this.metadata = this.readMetadata();
        this.state = this.reactive({
            value: this.metadata.value,
            label: this.metadata.label,
            selection: this.metadata.selection,
            selectionCustom: this.metadata.selectionCustom,
            description: this.metadata.description,
            keywords: this.metadata.keywords,
            disabled: this.metadata.disabled,
            attached: false,
        });
        this.presentation = this.mode === 'primary'
            ? new StyledOptionPresentation(this)
            : null;
        this.connectOwner();
        this.presentation?.mount();

        queueMicrotask(() => {
            if (!this.el.isConnected || this.selectOwner || this.ownerErrorReported) return;
            this.ownerErrorReported = true;
            console.error("Component 'option' requires an ancestor component 'select'.");
        });
    }

    mergeScope() {
        return {
            get value() {
                return this.state.value;
            },
            get label() {
                return this.state.label;
            },
            get selection() {
                return this.state.selection;
            },
            get selectionCustom() {
                return this.state.selectionCustom;
            },
            get description() {
                return this.state.description;
            },
            get keywords() {
                return this.state.keywords;
            },
            get selected() {
                return this.isSelected();
            },
            set selected(value) {
                if (value) this.select();
                else this.unselect();
            },
            get disabled() {
                return this.isDisabled();
            },
            set disabled(value) {
                if (value) this.disable();
                else this.enable();
            },
            get attached() {
                return this.state.attached;
            },
            get matchesQuery() {
                return this.matches();
            },
            select: this.select,
            unselect: this.unselect,
            toggle: this.toggle,
            enable: this.enable,
            disable: this.disable,
            matches: this.matches,
        };
    }

    readMetadata() {
        return {
            value: this.resolveValue(),
            label: this.resolveLabel(),
            selection: this.resolveSelection(),
            selectionCustom: this.hasCustomSelection(),
            description: this.resolveDescription(),
            keywords: this.resolveKeywords(),
            disabled: this.el.hasAttribute('disabled'),
            selected: this.hasSelectedAttribute(),
        };
    }

    syncMetadata() {
        this.metadata = this.readMetadata();
        if (!this.state) return;
        this.state.value = this.metadata.value;
        this.state.label = this.metadata.label;
        this.state.selection = this.metadata.selection;
        this.state.selectionCustom = this.metadata.selectionCustom;
        this.state.description = this.metadata.description;
        this.state.keywords = this.metadata.keywords;
        this.state.disabled = this.metadata.disabled;
    }

    resolveValue() {
        if (this.attrs.has('value')) return String(this.attrs.get('value') ?? '');
        const label = this.explicitLabel();
        if (label !== null) return label;
        return this.defaultText();
    }

    optionValue() {
        return this.state?.value ?? this.resolveValue();
    }

    explicitLabel() {
        if (!this.attrs.has('label')) return null;
        return String(this.attrs.get('label') ?? '').trim();
    }

    defaultText() {
        return normalizeText(this.slots.get('default').text());
    }

    resolveLabel() {
        const explicit = this.explicitLabel();
        if (explicit) return explicit;
        const text = this.defaultText();
        if (text) return text;
        return this.resolveValue();
    }

    labelText() {
        return this.state?.label ?? this.resolveLabel();
    }

    resolveDescription() {
        if (this.attrs.has('description')) {
            return String(this.attrs.get('description') ?? '').trim();
        }
        return normalizeText(this.slots.get('description').text());
    }

    descriptionText() {
        return this.state?.description ?? this.resolveDescription();
    }

    resolveKeywords() {
        return String(this.attrs.get('keywords') ?? '').trim();
    }

    keywordsText() {
        return this.state?.keywords ?? this.resolveKeywords();
    }

    resolveSelection() {
        const selection = this.slots.get('selection').attrs(this.attrs.for('selection'));
        if (selection.filled()) {
            return selection.all().map((node) => (
                node.nodeType === Node.ELEMENT_NODE && node.localName === 'template'
                    ? node.innerHTML
                    : (node.outerHTML ?? node.textContent ?? '')
            )).join('');
        }
        return this.renderFallbackSelection();
    }

    renderFallbackSelection() {
        const pieces = [];
        const avatar = this.attrs.get('avatar');
        const icon = this.attrs.get('icon');
        if (avatar !== null && avatar !== undefined && String(avatar) !== '') {
            const value = String(avatar);
            const isImage = value.includes('/');
            pieces.push(renderElement(
                'span',
                this.attrs.for('avatar').merge({
                    'x-is': 'avatar',
                    src: isImage ? value : undefined,
                    placeholder: isImage ? undefined : true,
                    size: 'xs',
                    ...generatedComponentAttributes(
                        `option:selection:avatar:${this.resolveValue()}`,
                    ),
                }),
                isImage ? '' : escapeHtml(value),
            ));
        } else if (icon) {
            pieces.push(renderElement(
                'span',
                this.attrs.for('selection-icon').merge({ class: icon }),
            ));
        }
        pieces.push(renderElement(
            'span',
            this.attrs.for('selection-label'),
            escapeHtml(this.resolveLabel() || this.resolveValue()),
        ));
        return renderElement(
            'span',
            this.attrs.for('selection-fallback').merge({
                'data-isas-option-selection-fallback': '',
            }),
            pieces.join(''),
        );
    }

    selectionHtml() {
        return this.state?.selection ?? this.resolveSelection();
    }

    hasCustomSelection() {
        return this.slots.get('selection').filled();
    }

    hasSelectedAttribute() {
        return this.el.hasAttribute('selected');
    }

    isDisabled() {
        return this.state?.disabled ?? this.el.hasAttribute('disabled');
    }

    isSelected() {
        return this.selectOwner?.store?.isOptionSelected(this) ?? false;
    }

    ownerSelect() {
        return this.selectOwner;
    }

    connectOwner() {
        const next = this.owner('select');
        if (next === this.selectOwner) return Boolean(next);
        this.selectOwner?.unregisterOption(this);
        this.selectOwner = next;
        this.ownerErrorReported = false;
        if (!next) {
            this._setStoreActive(false);
            return false;
        }
        next.registerOption(this);
        return true;
    }

    select() {
        return this.selectOwner?.store?.selectOption(this) ?? false;
    }

    unselect() {
        return this.selectOwner?.store?.unselectOption(this) ?? false;
    }

    toggle() {
        return this.selectOwner?.store?.toggleOption(this) ?? false;
    }

    activate() {
        return this.presentation?.activate() ?? false;
    }

    enable() {
        if (!this.el.hasAttribute('disabled')) return false;
        const previous = this.metadata;
        this.runtime.mutateHost((element) => element.removeAttribute('disabled'));
        this.syncMetadata();
        this.selectOwner?.optionChanged(this, 'disabled', previous);
        return true;
    }

    disable() {
        if (this.el.hasAttribute('disabled')) return false;
        const previous = this.metadata;
        this.runtime.mutateHost((element) => element.setAttribute('disabled', ''));
        this.syncMetadata();
        this.selectOwner?.optionChanged(this, 'disabled', previous);
        return true;
    }

    matches(query = this.selectOwner?.query() ?? '') {
        const needle = String(query ?? '').trim().toLocaleLowerCase();
        if (!needle) return true;
        return [
            this.labelText(),
            this.optionValue(),
            this.descriptionText(),
            this.keywordsText(),
        ].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle));
    }

    _setStoreActive(active) {
        if (this.state) this.state.attached = Boolean(active);
    }

    _syncSelectedAttribute(selected) {
        if (this.el.localName === 'option'
            && this.selectOwner?.el?.localName === 'select') {
            this.el.selected = Boolean(selected);
            return;
        }
        if (this.el.hasAttribute('selected') === Boolean(selected)) return;
        this.runtime.mutateHost((element) => element.toggleAttribute('selected', selected));
    }

    attributeChanged(name) {
        if (![
            'value',
            'label',
            'selected',
            'disabled',
            'description',
            'keywords',
            'avatar',
            'icon',
        ].includes(name)) return;
        const previous = this.metadata;
        this.syncMetadata();
        this.connectOwner();
        this.selectOwner?.optionChanged(this, name, previous);
    }

    sourceChanged() {
        const previous = this.metadata;
        this.syncMetadata();
        this.connectOwner();
        this.selectOwner?.optionChanged(this, 'source', previous);
    }

    hostAttributes() {
        return this.presentation?.hostAttributes() ?? {};
    }

    render() {
        if (this.presentation) return this.presentation.render();
        const content = this.slots.get('default');
        return content.filled()
            ? content.html()
            : escapeHtml(this.labelText() || this.optionValue());
    }

    destroy() {
        this.selectOwner?.unregisterOption(this);
        this.selectOwner = null;
        if (this.state) this.state.attached = false;
    }
}
