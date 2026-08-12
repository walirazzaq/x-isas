import { generatedComponentAttributes } from '../../support/generated-component.js';
import { escapeHtml, renderElement } from '../../support/html.js';

export class StyledOptionPresentation {
    constructor(option) {
        this.option = option;
    }

    mount() {
        this.option.listen(this.option.el, 'click', (event) => {
            if (event.defaultPrevented || event.button > 0) return;
            this.activate();
        });
        this.option.listen(this.option.el, 'keydown', (event) => this.handleKeydown(event));
        const effect = globalThis.Alpine.effect(() => {
            this.option.isSelected();
            this.option.isDisabled();
            this.option.selectOwner?.state?.query;
            this.option.selectOwner?.state?.filter;
            queueMicrotask(() => {
                if (this.option.el.isConnected) this.syncHostState();
            });
        });
        this.option.onCleanup(() => globalThis.Alpine.release?.(effect));
    }

    activate() {
        const changed = this.option.toggle();
        if (changed) this.option.selectOwner?.optionActivated?.(this.option);
        return changed;
    }

    handleKeydown(event) {
        const actions = {
            ArrowDown: () => this.option.selectOwner?.focusAdjacentOption?.(this.option, 1),
            ArrowUp: () => this.option.selectOwner?.focusAdjacentOption?.(this.option, -1),
            Home: () => this.option.selectOwner?.focusFirstVisibleOption?.(),
            End: () => this.option.selectOwner?.focusLastVisibleOption?.(),
            Escape: () => this.option.selectOwner?.close?.(),
        };
        if (['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            this.activate();
            return;
        }
        const action = actions[event.key];
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        action();
    }

    hostAttributes() {
        return {
            role: 'option',
            tabindex: '-1',
            'aria-selected': this.option.isSelected() ? 'true' : 'false',
            'aria-disabled': this.option.isDisabled() ? 'true' : 'false',
            'data-selected': this.option.isSelected() || undefined,
            'data-disabled': this.option.isDisabled() || undefined,
            hidden: this.option.selectOwner?.filterMode() === 'local'
                && !this.option.matches(),
            'data-isas-option': '',
        };
    }

    syncHostState() {
        const selected = this.option.isSelected();
        const disabled = this.option.isDisabled();
        const hidden = this.option.selectOwner?.filterMode() === 'local'
            && !this.option.matches();
        this.option.runtime.mutateHost((element) => {
            element.setAttribute('role', 'option');
            element.setAttribute('tabindex', '-1');
            element.setAttribute('aria-selected', selected ? 'true' : 'false');
            element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
            element.toggleAttribute('data-selected', selected);
            element.toggleAttribute('data-disabled', disabled);
            element.hidden = Boolean(hidden);
        });
    }

    renderPrepend() {
        const { option } = this;
        if (option.slots.get('prepend').filled()) {
            return renderElement(
                'span',
                option.attrs.for('prepend'),
                option.slots.get('prepend').html(),
            );
        }

        const pieces = [];
        const avatar = option.attrs.get('avatar');
        const icon = option.attrs.get('icon');
        if (avatar !== null && avatar !== undefined && String(avatar) !== '') {
            const value = String(avatar);
            const isImage = value.includes('/');
            pieces.push(renderElement(
                'span',
                option.attrs.for('avatar').merge({
                    'x-is': 'avatar',
                    src: isImage ? value : undefined,
                    placeholder: isImage ? undefined : true,
                    size: 'xs',
                    ...generatedComponentAttributes(`option:avatar:${option.resolveValue()}`),
                }),
                isImage ? '' : escapeHtml(value),
            ));
        }
        if (icon) {
            pieces.push(renderElement('span', option.attrs.for('icon').merge({ class: icon })));
        }
        return pieces.length
            ? renderElement('span', option.attrs.for('prepend'), pieces.join(''))
            : '';
    }

    render() {
        const { option } = this;
        const content = option.slots.get('default').filled()
            ? option.slots.get('default').html()
            : escapeHtml(option.labelText() || option.optionValue());
        const label = renderElement('span', option.attrs.for('label'), content);
        const description = option.descriptionText()
            ? renderElement(
                'span',
                option.attrs.for('description'),
                option.slots.get('description').filled()
                    ? option.slots.get('description').html()
                    : escapeHtml(option.descriptionText()),
            )
            : '';
        const body = renderElement('span', option.attrs.for('body'), `${label}${description}`);
        const appendValue = option.attrs.get('append');
        const append = option.slots.get('append').filled()
            ? renderElement('span', option.attrs.for('append'), option.slots.get('append').html())
            : (appendValue !== null
                && appendValue !== undefined
                && String(appendValue) !== ''
                ? renderElement('span', option.attrs.for('append'), escapeHtml(appendValue))
                : '');
        const indicatorIcon = option.attrs.get('indicator') || 'i-tabler-check';
        const indicator = option.slots.get('indicator').filled()
            ? renderElement(
                'span',
                option.attrs.for('indicator'),
                option.slots.get('indicator').html(),
            )
            : renderElement(
                'span',
                option.attrs.for('indicator'),
                renderElement(
                    'span',
                    option.attrs.for('indicator-icon').class(indicatorIcon),
                ),
            );

        return `${this.renderPrepend()}${body}${append}${indicator}`;
    }
}
