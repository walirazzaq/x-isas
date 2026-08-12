import { Component } from '../../component.js';
import { setAttributeIfChanged, visibleNodes } from '../../support/html.js';
import { TargetController } from './target-controller.js';

const VALID_DROPDOWN_PLACEMENTS = new Set([
    'top',
    'top-start',
    'top-end',
    'right',
    'right-start',
    'right-end',
    'bottom',
    'bottom-start',
    'bottom-end',
    'left',
    'left-start',
    'left-end',
]);
const VALID_CLOSED_BY = new Set(['any', 'closerequest', 'none']);

export class TargetComponent extends Component {
    static preserveHostDuringMorph = true;

    adaptive = false;
    requiresContent = false;

    mount() {
        this.validateHost();
        this.validateContentSource();
        this.hadLivewireIgnoreSelf = Object.hasOwn(this.el, '__livewire_ignore_self');
        this.livewireIgnoreSelf = this.el.__livewire_ignore_self;
        this.el.__livewire_ignore_self = true;
        this.controller = new TargetController(this);
        this.controller.mount();
    }

    validateHost() {}

    validateContentSource() {
        if (!this.requiresContent) return;
        const content = [...this.el.children].filter(
            (child) => child.getAttribute('x-part') === 'content',
        );
        if (content.length !== 1) {
            throw new Error(`Component '${this.name}' requires exactly one x-part='content'.`);
        }
        const visibleSiblings = [...this.el.childNodes].filter((node) => (
            node !== content[0]
            && (
                (node.nodeType === Node.TEXT_NODE && Boolean(node.textContent.trim()))
                || node.nodeType === Node.ELEMENT_NODE
            )
        ));
        if (visibleSiblings.length) {
            throw new Error(
                `Component '${this.name}' content part must be its only visible direct child.`,
            );
        }
    }

    prepareRender() {
        if (this.requiresContent) {
            const content = this.parts.all('content');
            if (content.length !== 1 || visibleNodes(this.slots.get('default')).length) {
                throw new Error(`Component '${this.name}' requires exactly one x-part='content'.`);
            }
        }
        return {
            presentation: this.presentation,
            resolvedPlacement: this.controller.state.resolvedPlacement,
        };
    }

    mergeScope() {
        return {
            get open() {
                return this.controller.state.open;
            },
            set open(value) {
                if (value) this.show();
                else this.hide();
            },
            get presentation() {
                return this.controller.state.presentation;
            },
            get target() {
                return this.el;
            },
            get activeTrigger() {
                return this.controller.activeTrigger?.el ?? null;
            },
            get linked() {
                return this.controller.triggers.size > 0;
            },
            show: this.show,
            hide: this.hide,
            close: this.close,
            toggle: this.toggle,
            requestClose: this.requestClose,
        };
    }

    get presentation() {
        return this.controller?.state.presentation ?? this.desiredPresentation();
    }

    desiredPresentation() {
        return 'dropdown';
    }

    displayWidth() {
        return globalThis.innerWidth ?? 0;
    }

    preferredDropdownPlacement() {
        const scoped = this.name === 'overlay'
            ? this.attrs?.for('dropdown').get('placement')
            : null;
        const value = String(scoped ?? this.attrs?.get('placement') ?? 'bottom-start');
        return VALID_DROPDOWN_PLACEMENTS.has(value) ? value : 'bottom-start';
    }

    dropdownOffset() {
        const scoped = this.name === 'overlay'
            ? this.attrs?.for('dropdown').get('offset')
            : null;
        const value = Number(scoped ?? this.attrs?.get('offset') ?? 8);
        return Number.isFinite(value) ? value : 8;
    }

    defaultClosedBy() {
        return 'closerequest';
    }

    closedBy() {
        const value = String(this.attrs?.get('closedby') ?? this.defaultClosedBy());
        return VALID_CLOSED_BY.has(value) ? value : this.defaultClosedBy();
    }

    setClosedBy(value) {
        this.el.setAttribute('closedby', String(value));
    }

    setMode(value) {
        this.el.setAttribute('mode', String(value));
    }

    setBreakpoint(value) {
        this.el.setAttribute('breakpoint', String(value));
    }

    syncPresentationAttributes() {
        setAttributeIfChanged(this.el, 'data-isas-presentation', this.presentation);
        if (this.name === 'dropdown' || this.name === 'overlay') {
            setAttributeIfChanged(this.el, 'popover', 'auto');
        }
        if (this.el.localName !== 'dialog') {
            if (this.presentation === 'dialog') {
                setAttributeIfChanged(this.el, 'role', 'dialog');
            }
            else if (!this.source.attributes.has('role')) this.el.removeAttribute('role');
        }
        if (this.el.localName === 'dialog') {
            setAttributeIfChanged(this.el, 'closedby', this.closedBy());
        }
        this.runtime.observer?.takeRecords();
    }

    hostAttributes() {
        let attributes = {
            'data-isas-presentation': this.presentation,
        };
        if (this.name === 'dropdown' || this.name === 'overlay') {
            attributes.popover = 'auto';
        }
        if (this.el.localName === 'dialog') attributes.closedby = this.closedBy();
        if (this.el.localName !== 'dialog' && this.presentation === 'dialog') {
            attributes.role = 'dialog';
        }
        return attributes;
    }

    show(options) {
        return this.controller.show(options);
    }

    hide(options) {
        return this.controller.hide(options);
    }

    close(returnValue, options) {
        return this.controller.close(returnValue, options);
    }

    toggle(options) {
        return this.controller.toggle(options);
    }

    requestClose(returnValue, options) {
        return this.controller.requestClose(returnValue, options);
    }

    attributeChanged(name) {
        if (name === 'id') this.controller.reconcileRegistration();
        if (['placement', 'offset'].includes(name) || name.startsWith('dropdown:')) {
            this.controller.startPositioning();
        }
        if (name === 'closedby') {
            this.syncPresentationAttributes();
            this.requestRender();
        }
    }

    sourceChanged() {
        this.controller.reconcileRegistration();
        this.controller.reconcilePresentation();
        this.syncPresentationAttributes();
    }

    destroy() {
        this.controller?.destroy();
        if (this.hadLivewireIgnoreSelf) {
            this.el.__livewire_ignore_self = this.livewireIgnoreSelf;
        } else {
            delete this.el.__livewire_ignore_self;
        }
    }
}
