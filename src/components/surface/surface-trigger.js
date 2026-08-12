import { Component } from '../../component.js';
import { targetRegistry } from './target-registry.js';

function disabled(element) {
    return element.matches?.('[disabled], [aria-disabled="true"]');
}

function snapshotAttributes(element, names) {
    return new Map(names.map((name) => [name, (
        element.hasAttribute(name) ? element.getAttribute(name) : null
    )]));
}

function restoreAttributes(element, snapshot) {
    for (const [name, value] of snapshot) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
    }
}

export class SurfaceTrigger extends Component {
    static attachable = true;
    static targetKind = null;

    mount() {
        if (this.mode !== 'attachment') return;
        this.controller = null;
        this.unsubscribe = null;
        this.warnedTargetId = null;
        this.ariaSnapshot = snapshotAttributes(this.el, [
            'aria-controls',
            'aria-expanded',
            'aria-haspopup',
        ]);

        this.listen(this.el, 'click', (event) => {
            if (disabled(this.el)) return;
            if (!this.controller) {
                this.warnUnresolved();
                return;
            }
            event.preventDefault();
            this.toggle();
        });
        this.listen(this.el, 'keydown', (event) => {
            if (!['Enter', ' '].includes(event.key) || disabled(this.el)) return;
            if (!this.controller) {
                this.warnUnresolved();
                return;
            }
            event.preventDefault();
            this.toggle();
        });

        queueMicrotask(() => {
            if (this.el.isConnected) this.relink();
        });
    }

    targetId() {
        return String(this.el.getAttribute(this.constructor.activationAttribute) ?? '').trim();
    }

    relink() {
        const id = this.targetId();
        if (!id) {
            this.unlink();
            throw new Error(
                `Attribute '${this.constructor.activationAttribute}' requires a target id.`,
            );
        }
        if (id === this.linkedId && this.unsubscribe) return;

        this.unlink();
        this.linkedId = id;
        this.unsubscribe = targetRegistry.subscribe(
            this.el.ownerDocument,
            this.constructor.targetKind,
            id,
            (controller) => this.setController(controller),
        );
    }

    setController(controller) {
        if (controller === this.controller) return;
        this.controller?.removeTrigger(this);
        this.controller = controller;
        this.controller?.addTrigger(this);
        this.warnedTargetId = null;
        this.syncAria();
    }

    unlink() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.linkedId = null;
        this.setController(null);
    }

    warnUnresolved() {
        const id = this.targetId();
        if (!id || this.warnedTargetId === id) return;
        this.warnedTargetId = id;
        console.warn(
            `No '${this.constructor.targetKind}' target with id '${id}' is currently available.`,
        );
    }

    syncAria() {
        if (!this.controller) {
            restoreAttributes(this.el, this.ariaSnapshot);
            return;
        }
        this.el.setAttribute('aria-controls', this.controller.id);
        this.el.setAttribute('aria-expanded', this.controller.state.open ? 'true' : 'false');
        this.el.setAttribute(
            'aria-haspopup',
            this.controller.state.presentation === 'dialog' ? 'dialog' : 'true',
        );
    }

    mergeScope() {
        if (this.mode !== 'attachment') return {};
        return {
            get open() {
                return this.controller?.state.open ?? false;
            },
            set open(value) {
                if (value) this.show();
                else this.hide();
            },
            get presentation() {
                return this.controller?.state.presentation
                    ?? this.constructor.targetKind;
            },
            get target() {
                return this.controller?.el ?? null;
            },
            get activeTrigger() {
                return this.controller?.activeTrigger?.el ?? null;
            },
            get linked() {
                return Boolean(this.controller);
            },
            show: this.show,
            hide: this.hide,
            close: this.close,
            toggle: this.toggle,
            requestClose: this.requestClose,
        };
    }

    show(options = {}) {
        if (!this.controller) {
            this.warnUnresolved();
            return false;
        }
        return this.controller.show({ ...options, source: options.source ?? this.el });
    }

    hide(options = {}) {
        return this.controller?.hide({ ...options, source: options.source ?? this.el }) ?? false;
    }

    close(returnValue, options = {}) {
        return this.controller?.close(
            returnValue,
            { ...options, source: options.source ?? this.el },
        ) ?? false;
    }

    toggle(options = {}) {
        if (!this.controller) {
            this.warnUnresolved();
            return false;
        }
        return this.controller.toggle({ ...options, source: options.source ?? this.el });
    }

    requestClose(returnValue, options = {}) {
        return this.controller?.requestClose(
            returnValue,
            { ...options, source: options.source ?? this.el },
        ) ?? false;
    }

    attributeChanged(name) {
        if (name === this.constructor.activationAttribute) {
            queueMicrotask(() => {
                if (this.el.isConnected) this.relink();
            });
        }
    }

    sourceChanged() {
        queueMicrotask(() => {
            if (this.el.isConnected) this.relink();
        });
    }

    destroy() {
        this.unlink();
        restoreAttributes(this.el, this.ariaSnapshot);
    }
}
