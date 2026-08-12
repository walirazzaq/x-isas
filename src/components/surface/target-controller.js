import { targetRegistry } from './target-registry.js';

const POSITION_STYLE_PROPERTIES = [
    'position',
    'inset',
    'margin',
    'position-area',
    'position-try',
    'left',
    'top',
];

let floatingLibraryPromise = null;

function floatingLibrary() {
    floatingLibraryPromise ??= import('@floating-ui/dom');
    return floatingLibraryPromise;
}

function popoverIsOpen(element) {
    if (element.hasAttribute('data-isas-popover-open')) return true;
    try {
        return element.matches(':popover-open');
    } catch {
        return element.hasAttribute('data-isas-popover-open');
    }
}

function toggleEvent(type, oldState, newState, source = null, cancelable = false) {
    if (typeof ToggleEvent === 'function') {
        return new ToggleEvent(type, {
            oldState,
            newState,
            source,
            cancelable,
        });
    }

    const event = new CustomEvent(type, {
        cancelable,
        detail: { oldState, newState, source },
    });
    Object.defineProperties(event, {
        oldState: { value: oldState },
        newState: { value: newState },
        source: { value: source },
    });
    return event;
}

function scrollSnapshot(root) {
    return [root, ...root.querySelectorAll('*')]
        .filter((element) => element.scrollTop || element.scrollLeft)
        .map((element) => ({
            element,
            top: element.scrollTop,
            left: element.scrollLeft,
        }));
}

function restoreScroll(snapshot) {
    for (const { element, top, left } of snapshot) {
        if (!element.isConnected) continue;
        element.scrollTop = top;
        element.scrollLeft = left;
    }
}

export class TargetController {
    constructor(component) {
        this.component = component;
        this.el = component.el;
        this.kind = component.name;
        this.id = '';
        this.state = component.reactive({
            open: false,
            presentation: component.desiredPresentation(),
            resolvedPlacement: component.preferredDropdownPlacement(),
        });
        this.triggers = new Set();
        this.activeTrigger = null;
        this.externalSource = null;
        this.returnValue = '';
        this.focusBeforeOpen = null;
        this.releasePositioning = null;
        this.positionSource = null;
        this.positioningPending = false;
        this.positionToken = 0;
        this.positionStyleSnapshot = null;
        this.transitioning = false;
        this.transitionTimer = null;
        this.displayEffect = null;
        this.registered = false;
        this.warnedAccessibleName = false;
    }

    mount() {
        if ((this.kind === 'dropdown' || this.kind === 'overlay')
            && this.el.localName !== 'dialog'
            && typeof this.el.showPopover !== 'function') {
            this.fallbackWasHidden = this.el.hidden;
            this.el.hidden = true;
        }
        this.reconcileRegistration();
        this.bindSurface();

        if (this.component.adaptive) {
            this.displayEffect = globalThis.Alpine.effect(() => {
                const width = this.component.displayWidth();
                queueMicrotask(() => {
                    if (this.el.isConnected) this.reconcilePresentation(width);
                });
            });
        }

        queueMicrotask(() => {
            if (!this.el.isConnected) return;
            this.component.syncPresentationAttributes();
            this.syncFromSurface();
            this.warnMissingAccessibleName();
        });
    }

    bindSurface() {
        const suppressTransitionEvent = (event) => {
            if (!this.transitioning) return;
            event.stopImmediatePropagation();
        };
        for (const type of ['beforetoggle', 'toggle', 'cancel', 'close']) {
            this.el.addEventListener(type, suppressTransitionEvent, true);
            this.component.onCleanup(() => (
                this.el.removeEventListener(type, suppressTransitionEvent, true)
            ));
        }

        this.component.listen(this.el, 'toggle', (event) => {
            const open = event.newState
                ? event.newState === 'open'
                : this.surfaceIsOpen();
            this.syncOpen(open, event.source ?? null);
        });

        this.component.listen(this.el, 'close', () => {
            if ('returnValue' in this.el) this.returnValue = this.el.returnValue ?? '';
            const wasOpen = this.state.open;
            this.syncOpen(false);
            if (wasOpen) this.restoreFocus();
        });

        this.component.listen(this.el, 'cancel', (event) => {
            if (this.component.closedBy() === 'none') event.preventDefault();
        });

        this.component.listen(this.el, 'pointerup', (event) => {
            if (!this.nativeDialogPresentation()
                || this.component.closedBy() !== 'any'
                || event.target !== this.el) {
                return;
            }
            this.requestClose();
        });

        this.component.listen(this.el.ownerDocument, 'keydown', (event) => {
            if (event.key !== 'Escape'
                || !this.state.open
                || !this.nativeDialogPresentation()
                || this.supportsClosedBy()) {
                return;
            }
            if (this.component.closedBy() === 'none') {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            event.preventDefault();
            this.requestClose();
        }, true);
    }

    supportsClosedBy() {
        return this.el.localName === 'dialog' && 'closedBy' in this.el;
    }

    reconcileRegistration() {
        const id = String(this.el.id ?? '').trim();
        if (!id) throw new Error(`Component '${this.kind}' requires a non-empty id.`);
        if (this.registered && id === this.id) return;

        targetRegistry.assertAvailable(this.el.ownerDocument, this.kind, id, this);
        if (this.registered) targetRegistry.unregister(this);
        this.id = id;
        targetRegistry.register(this);
        this.registered = true;
        this.syncTriggers();
    }

    addTrigger(trigger) {
        this.triggers.add(trigger);
        trigger.syncAria();
    }

    removeTrigger(trigger) {
        this.triggers.delete(trigger);
        if (this.activeTrigger === trigger) this.activeTrigger = null;
    }

    syncTriggers() {
        for (const trigger of this.triggers) trigger.syncAria();
    }

    sourceElement(source = null) {
        if (source?.nodeType === Node.ELEMENT_NODE) {
            this.activeTrigger = [...this.triggers].find((trigger) => trigger.el === source)
                ?? this.activeTrigger;
            this.externalSource = source;
            return source;
        }
        if (source?.el?.nodeType === Node.ELEMENT_NODE) {
            this.activeTrigger = source;
            this.externalSource = source.el;
            return source.el;
        }
        if (this.activeTrigger?.el?.isConnected) return this.activeTrigger.el;
        const first = [...this.triggers].find((trigger) => trigger.el.isConnected) ?? null;
        this.activeTrigger = first;
        if (first) return first.el;
        return this.externalSource?.isConnected ? this.externalSource : null;
    }

    show({ source = null } = {}) {
        if (this.state.open) return false;
        const sourceElement = this.sourceElement(source);
        if (this.state.presentation === 'dropdown' && !sourceElement) {
            console.warn(`Component '${this.kind}' requires a linked trigger to open as a dropdown.`);
            return false;
        }

        this.focusBeforeOpen = this.el.ownerDocument.activeElement;
        const native = this.hasNativeOpeningMethod();
        if (!native && !this.dispatchBeforeToggle(false, sourceElement)) return false;

        try {
            this.openSurface(sourceElement);
        } catch {
            return false;
        }
        if (!this.surfaceIsOpen()) return false;

        this.syncOpen(true, sourceElement);
        if (!native) this.dispatchToggle(false, sourceElement);
        return true;
    }

    hide(options = {}) {
        return this.close(undefined, options);
    }

    close(returnValue, { source = null } = {}) {
        if (!this.state.open) return false;
        const sourceElement = this.sourceElement(source);
        const native = this.hasNativeClosingMethod();
        if (!native && !this.dispatchBeforeToggle(true, sourceElement)) return false;

        this.closeSurface(returnValue);
        if (this.surfaceIsOpen()) return false;

        if (returnValue !== undefined) this.returnValue = String(returnValue);
        this.syncOpen(false, sourceElement);
        if (!native) {
            this.dispatchToggle(true, sourceElement);
            if (this.state.presentation === 'dialog') {
                this.el.dispatchEvent(new Event('close'));
            }
        }
        if (this.state.presentation === 'dialog') this.restoreFocus();
        return true;
    }

    toggle(options = {}) {
        return this.state.open ? this.hide(options) : this.show(options);
    }

    requestClose(returnValue, options = {}) {
        if (!this.state.open) return false;
        if (this.nativeDialogPresentation()
            && typeof this.el.requestClose === 'function') {
            if (returnValue === undefined) this.el.requestClose();
            else this.el.requestClose(String(returnValue));
            this.syncFromSurface();
            return !this.state.open;
        }

        if (this.state.presentation === 'dialog') {
            const cancel = new Event('cancel', { cancelable: true });
            if (!this.el.dispatchEvent(cancel)) return false;
        }
        return this.close(returnValue, options);
    }

    dispatchBeforeToggle(open, source) {
        return this.el.dispatchEvent(toggleEvent(
            'beforetoggle',
            open ? 'open' : 'closed',
            open ? 'closed' : 'open',
            source,
            true,
        ));
    }

    dispatchToggle(wasOpen, source) {
        this.el.dispatchEvent(toggleEvent(
            'toggle',
            wasOpen ? 'open' : 'closed',
            wasOpen ? 'closed' : 'open',
            source,
        ));
    }

    nativeDialogPresentation() {
        return this.state.presentation === 'dialog' && this.el.localName === 'dialog';
    }

    hasNativeOpeningMethod() {
        if (this.nativeDialogPresentation()) return typeof this.el.showModal === 'function';
        return typeof this.el.showPopover === 'function';
    }

    hasNativeClosingMethod() {
        if (this.nativeDialogPresentation()) return typeof this.el.close === 'function';
        return typeof this.el.hidePopover === 'function';
    }

    surfaceIsOpen() {
        if (this.nativeDialogPresentation()) return Boolean(this.el.open);
        return popoverIsOpen(this.el);
    }

    openSurface(source) {
        if (this.nativeDialogPresentation()) {
            if (popoverIsOpen(this.el)) this.hidePopover();
            if (typeof this.el.showModal === 'function') this.el.showModal();
            else this.el.setAttribute('open', '');
        } else if (typeof this.el.showPopover === 'function') {
            try {
                this.el.showPopover({ source });
            } catch {
                this.el.showPopover();
            }
        } else {
            this.el.hidden = false;
            this.el.setAttribute('data-isas-popover-open', '');
        }

        if (this.state.presentation === 'dropdown') this.startPositioning();
    }

    closeSurface(returnValue) {
        this.stopPositioning();
        if (this.nativeDialogPresentation()) {
            if (this.el.open && typeof this.el.close === 'function') {
                if (returnValue === undefined) this.el.close();
                else this.el.close(String(returnValue));
            } else {
                this.el.removeAttribute('open');
            }
        } else {
            this.hidePopover();
        }
    }

    hidePopover() {
        if (popoverIsOpen(this.el) && typeof this.el.hidePopover === 'function') {
            this.el.hidePopover();
        } else {
            this.el.removeAttribute('data-isas-popover-open');
            if (typeof this.el.showPopover !== 'function') this.el.hidden = true;
        }
    }

    syncFromSurface() {
        this.syncOpen(this.surfaceIsOpen());
    }

    syncOpen(open, source = null) {
        if (source) this.sourceElement(source);
        if (open === this.state.open) {
            this.syncTriggers();
            return;
        }
        this.state.open = open;
        if (!open) this.stopPositioning();
        this.syncTriggers();
        this.component.requestRender();
    }

    reconcilePresentation(width = this.component.displayWidth()) {
        const next = this.component.desiredPresentation(width);
        if (next === this.state.presentation) return false;

        const previous = this.state.presentation;
        const wasOpen = this.state.open;
        const focused = this.el.contains(this.el.ownerDocument.activeElement)
            ? this.el.ownerDocument.activeElement
            : null;
        const scroll = scrollSnapshot(this.el);
        const source = this.sourceElement();

        this.transitioning = true;
        clearTimeout(this.transitionTimer);
        this.stopPositioning();

        if (wasOpen && this.el.localName === 'dialog') this.closeSurface();
        this.state.presentation = next;
        this.component.syncPresentationAttributes();
        this.component.requestRender();

        if (wasOpen && this.el.localName === 'dialog') this.openSurface(source);
        else if (wasOpen && next === 'dropdown') this.startPositioning();

        this.state.open = wasOpen;
        this.syncTriggers();
        restoreScroll(scroll);
        queueMicrotask(() => {
            restoreScroll(scroll);
            if (focused?.isConnected) focused.focus({ preventScroll: true });
        });

        this.el.dispatchEvent(new CustomEvent('presentationchange', {
            detail: {
                oldPresentation: previous,
                newPresentation: next,
            },
        }));

        this.transitionTimer = setTimeout(() => {
            this.transitioning = false;
        }, 0);
        return true;
    }

    async startPositioning() {
        const source = this.sourceElement();
        if (!source || !this.state.open || this.state.presentation !== 'dropdown') return;
        if (this.positionStyleSnapshot) {
            // Reposition an already-open surface without restoring its document-
            // flow styles between observers. Restoring here produces a visible
            // frame at the unanchored position during parent component morphs.
            this.positionToken += 1;
            this.releasePositioning?.();
            this.releasePositioning = null;
            this.positionSource = null;
        } else {
            this.stopPositioning();
        }
        const token = ++this.positionToken;
        this.positionSource = source;
        this.positioningPending = true;
        const floating = await floatingLibrary();
        if (token !== this.positionToken
            || !this.state.open
            || this.state.presentation !== 'dropdown'
            || !source.isConnected) {
            if (token === this.positionToken) this.positioningPending = false;
            return;
        }

        this.capturePositionStyles();
        this.positioningPending = false;
        this.releasePositioning = floating.autoUpdate(
            source,
            this.el,
            () => this.updatePosition(floating, source, token),
        );
    }

    async refreshPositioning() {
        const source = this.sourceElement();
        if (!source || !this.state.open || this.state.presentation !== 'dropdown') return;
        if (this.positioningPending && source === this.positionSource) return;
        if (this.releasePositioning && source === this.positionSource) {
            const positioned = this.el.style.position === 'fixed'
                && Boolean(this.el.style.left)
                && Boolean(this.el.style.top);
            if (positioned) return;
            const token = this.positionToken;
            const floating = await floatingLibrary();
            if (token === this.positionToken && this.state.open) {
                await this.updatePosition(floating, source, token);
            }
            return;
        }

        // Parent component morphs can replace the trigger while the independently
        // owned surface stays open. Rebind autoUpdate without restoring the
        // pre-open position styles, which would visibly flash the surface at its
        // document-flow position between the old and new anchors.
        const token = ++this.positionToken;
        this.releasePositioning?.();
        this.releasePositioning = null;
        this.positionSource = source;
        this.positioningPending = true;
        const floating = await floatingLibrary();
        if (token !== this.positionToken
            || !this.state.open
            || this.state.presentation !== 'dropdown'
            || !source.isConnected) {
            if (token === this.positionToken) this.positioningPending = false;
            return;
        }

        this.capturePositionStyles();
        this.positioningPending = false;
        this.releasePositioning = floating.autoUpdate(
            source,
            this.el,
            () => this.updatePosition(floating, source, token),
        );
    }

    capturePositionStyles() {
        if (this.positionStyleSnapshot) return;
        this.positionStyleSnapshot = new Map(POSITION_STYLE_PROPERTIES.map((name) => [
            name,
            this.el.style.getPropertyValue(name),
        ]));
    }

    updatePosition(floating, source, token) {
        if (token !== this.positionToken
            || !this.state.open
            || this.state.presentation !== 'dropdown') {
            return Promise.resolve();
        }

        Object.assign(this.el.style, {
            position: 'fixed',
            inset: 'auto',
            margin: '0px',
            positionArea: 'none',
            positionTry: 'none',
        });
        this.component.runtime.observer?.takeRecords();

        return floating.computePosition(source, this.el, {
            placement: this.component.preferredDropdownPlacement(),
            strategy: 'fixed',
            middleware: [
                floating.offset(this.component.dropdownOffset()),
                floating.flip(),
                floating.shift({ padding: 8 }),
            ],
        }).then(({ x, y, placement }) => {
            if (token !== this.positionToken || !this.state.open) return;
            this.el.style.left = `${x}px`;
            this.el.style.top = `${y}px`;
            this.component.runtime.observer?.takeRecords();
            if (placement !== this.state.resolvedPlacement) {
                this.state.resolvedPlacement = placement;
                this.component.requestRender();
            }
        });
    }

    stopPositioning() {
        this.positionToken += 1;
        this.releasePositioning?.();
        this.releasePositioning = null;
        this.positionSource = null;
        this.positioningPending = false;
        if (!this.positionStyleSnapshot) return;
        for (const [name, value] of this.positionStyleSnapshot) {
            if (value) this.el.style.setProperty(name, value);
            else this.el.style.removeProperty(name);
        }
        this.positionStyleSnapshot = null;
        this.component.runtime.observer?.takeRecords();
    }

    restoreFocus() {
        const linkedTrigger = [...this.triggers].find((trigger) => trigger.el.isConnected);
        const target = this.activeTrigger?.el?.isConnected
            ? this.activeTrigger.el
            : linkedTrigger?.el
                ?? (this.focusBeforeOpen?.isConnected ? this.focusBeforeOpen : null);
        this.focusBeforeOpen = null;
        if (!target?.focus) return;
        queueMicrotask(() => {
            if (target.isConnected) target.focus({ preventScroll: true });
        });
    }

    warnMissingAccessibleName() {
        if (this.warnedAccessibleName
            || this.state.presentation !== 'dialog'
            || this.el.hasAttribute('aria-label')
            || this.el.hasAttribute('aria-labelledby')) {
            return;
        }
        this.warnedAccessibleName = true;
        console.warn(
            `Component '${this.kind}' target '${this.id}' needs aria-label or aria-labelledby.`,
        );
    }

    destroy() {
        clearTimeout(this.transitionTimer);
        this.stopPositioning();
        if (this.registered) targetRegistry.unregister(this);
        this.registered = false;
        for (const trigger of [...this.triggers]) trigger.setController(null);
        this.triggers.clear();
        if (this.fallbackWasHidden !== undefined) this.el.hidden = this.fallbackWasHidden;
        if (this.displayEffect) globalThis.Alpine.release?.(this.displayEffect);
        this.displayEffect = null;
    }
}
