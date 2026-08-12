import {
    arrow,
    autoUpdate,
    computePosition,
    flip,
    offset,
} from '@floating-ui/dom';
import { Component } from '../../component.js';
import { GENERATED_COMPONENT_ATTRIBUTE } from '../../support/generated-component.js';
import {
    escapeHtml,
    hasVisibleContent,
    setAttributes,
} from '../../support/html.js';

const POSITIONS = new Set(['top', 'right', 'bottom', 'left']);
const ALIGNMENTS = new Set(['start', 'center', 'end']);
const CLOSE_GRACE_MS = 80;
const POSITION_GAP = 8;
const ARROW_PADDING = 4;
const FALLBACK_SIDES = Object.freeze({
    top: ['bottom', 'right', 'left'],
    bottom: ['top', 'right', 'left'],
    right: ['left', 'bottom', 'top'],
    left: ['right', 'bottom', 'top'],
});
const OPPOSITE_SIDE = Object.freeze({
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
});

let nextTooltipId = 0;
let activeTooltip = null;

function placementSide(placement) {
    const side = String(placement ?? '').split('-', 1)[0];
    return POSITIONS.has(side) ? side : 'top';
}

function placementFor(side, align) {
    return align === 'center' ? side : `${side}-${align}`;
}

function validPlacement(placement) {
    const [side, align, extra] = String(placement ?? '').split('-');
    return POSITIONS.has(side)
        && extra === undefined
        && (align === undefined || align === 'start' || align === 'end');
}

export class Tooltip extends Component {
    static attachable = true;
    static activationAttribute = 'tooltip';
    static structural = true;

    mount() {
        if (this.mode !== 'attachment') return;

        this.state = this.reactive({
            open: false,
            preferredPlacement: this.preferredPlacement(),
            placement: this.preferredPlacement(),
            side: this.preferredSide(),
            align: this.preferredAlign(),
            isFlipped: false,
        });
        this.triggerHovered = false;
        this.triggerFocused = false;
        this.overlayHovered = false;
        this.overlayFocused = false;
        this.closeTimer = null;
        this.releasePositioning = null;
        this.escapeCleanup = null;
        this.overlay = null;
        this.overlayRuntime = null;
        this.overlayScopeCleanup = null;
        this.overlayId = `x-isas-tooltip-${++nextTooltipId}`;
        this.topLayerOpen = false;
        this.hasContent = false;

        this.listen(this.el, 'pointerenter', () => {
            this.triggerHovered = true;
            this.cancelClose();
            this.open();
        });
        this.listen(this.el, 'pointerleave', () => {
            this.triggerHovered = false;
            this.scheduleClose();
        });
        this.listen(this.el, 'focusin', () => {
            this.triggerFocused = true;
            this.cancelClose();
            this.open();
        });
        this.listen(this.el, 'focusout', (event) => {
            if (this.el.contains(event.relatedTarget)) return;
            this.triggerFocused = false;
            this.scheduleClose();
        });

        this.syncOverlay();
    }

    mergeScope() {
        if (this.mode !== 'attachment') return {};

        return {
            get open() {
                return this.state.open;
            },
            set open(value) {
                if (value) this.open();
                else this.close();
            },
            get placement() {
                return this.state.placement;
            },
            get preferredPlacement() {
                return this.state.preferredPlacement;
            },
            get side() {
                return this.state.side;
            },
            get align() {
                return this.state.align;
            },
            get isFlipped() {
                return this.state.isFlipped;
            },
        };
    }

    preferredSide() {
        const placement = this.attrs?.get('tooltip:placement');
        if (POSITIONS.has(placement)) return placement;

        const position = this.attrs?.get('tooltip:position');
        return POSITIONS.has(position) ? position : 'top';
    }

    preferredAlign() {
        const align = this.attrs?.get('tooltip:align');
        return ALIGNMENTS.has(align) ? align : 'center';
    }

    preferredPlacement() {
        return placementFor(this.preferredSide(), this.preferredAlign());
    }

    fallbackPlacements() {
        const align = this.preferredAlign();
        return FALLBACK_SIDES[this.preferredSide()]
            .map((side) => placementFor(side, align));
    }

    richTemplate() {
        return this.source?.childNodes().find((node) => (
            node.nodeType === Node.ELEMENT_NODE
            && node.localName === 'template'
            && node.getAttribute('slot') === 'tooltip'
            && hasVisibleContent(node)
        )) ?? null;
    }

    overlaySource() {
        const overlay = document.createElement('div');
        const forwarded = this.attrs.for('tooltip').except(
            'id',
            'role',
            'popover',
            'x-is',
            'content',
            'open',
            'placement',
            'preferred-placement',
            'position',
            'align',
            'data-placement',
            'data-side',
            'data-flipped',
            'data-open',
        );
        const template = this.richTemplate();
        const text = String(this.attrs.get('tooltip', '') ?? '');
        const preferredPlacement = this.preferredPlacement();
        const side = placementSide(this.state?.placement ?? preferredPlacement);
        const align = this.preferredAlign();
        const isFlipped = side !== this.preferredSide();

        overlay.setAttribute('x-is', 'tooltip');
        overlay.setAttribute(GENERATED_COMPONENT_ATTRIBUTE, `tooltip:${this.overlayId}`);
        overlay.setAttribute('data-isas-tooltip-overlay', '');
        overlay.setAttribute('id', this.overlayId);
        overlay.setAttribute('role', 'tooltip');
        overlay.setAttribute('popover', 'manual');
        overlay.setAttribute('preferred-placement', preferredPlacement);
        overlay.setAttribute('placement', this.state?.placement ?? preferredPlacement);
        overlay.setAttribute('align', align);
        overlay.setAttribute('data-placement', this.state?.placement ?? preferredPlacement);
        overlay.setAttribute('data-side', side);
        if (isFlipped) overlay.setAttribute('data-flipped', '');
        if (this.state?.open) {
            overlay.setAttribute('open', '');
            overlay.setAttribute('data-open', '');
        }
        overlay.setAttribute('content', template ? '' : text);
        setAttributes(overlay, forwarded);
        if (template) overlay.innerHTML = template.innerHTML;

        this.hasContent = Boolean(template || text);
        return overlay;
    }

    createOverlay(source) {
        this.overlay = source;
        // A body-level overlay would otherwise start a new Alpine tree. Graft the
        // trigger's data stack onto it, as Alpine's x-teleport directive does,
        // and retain the logical-parent link used by Alpine and Livewire when
        // resolving the closest component across a teleport boundary.
        this.overlayScopeCleanup = globalThis.Alpine.addScopeToNode(
            this.overlay,
            {},
            this.el,
        );
        this.overlay._x_teleportBack = this.el;
        document.body.append(this.overlay);
        globalThis.Alpine.initTree(this.overlay);
        this.overlayRuntime = this.runtime.constructor.from(this.overlay);
        this.listen(this.overlay, 'pointerenter', () => {
            this.overlayHovered = true;
            this.cancelClose();
            this.open();
        });
        this.listen(this.overlay, 'pointerleave', () => {
            this.overlayHovered = false;
            this.scheduleClose();
        });
        this.listen(this.overlay, 'focusin', () => {
            this.overlayFocused = true;
            this.cancelClose();
            this.open();
        });
        this.listen(this.overlay, 'focusout', (event) => {
            if (this.overlay.contains(event.relatedTarget)) return;
            this.overlayFocused = false;
            this.scheduleClose();
        });
        this.applyPortalStyles();
    }

    syncOverlay() {
        if (this.mode !== 'attachment') return;

        const preferredPlacement = this.preferredPlacement();
        this.state.preferredPlacement = preferredPlacement;
        this.state.placement = preferredPlacement;
        this.state.side = this.preferredSide();
        this.state.align = this.preferredAlign();
        this.state.isFlipped = false;

        const source = this.overlaySource();
        if (!this.overlay) this.createOverlay(source);
        else this.overlayRuntime?.reconcileFrom(source);

        this.applyPortalStyles();
        this.syncDescribedBy(this.hasContent);

        if (!this.hasContent && this.state.open) this.close();
        else if (this.state.open) this.updatePosition();
    }

    setOverlayAttributes(attributes, { render = false } = {}) {
        if (!this.overlay) return;
        let changed = false;

        for (const [name, value] of Object.entries(attributes)) {
            const normalized = value === null || value === false || value === undefined
                ? null
                : value === true ? '' : value;
            const current = this.overlayRuntime?.source.attributes.get(name);
            const present = this.overlayRuntime?.source.attributes.has(name);
            if (normalized === null
                ? present
                : !present || String(current) !== String(normalized)) {
                changed = true;
            }
            this.overlayRuntime?.source.setAttribute(name, normalized);
        }

        this.overlayRuntime?.mutateHost((element) => {
            for (const [name, value] of Object.entries(attributes)) {
                if (value === null || value === false || value === undefined) {
                    element.removeAttribute(name);
                } else {
                    element.setAttribute(name, value === true ? '' : String(value));
                }
            }
        });
        if (render && changed) this.overlayRuntime?.renderNow();
    }

    applyPortalStyles() {
        this.overlayRuntime?.mutateHost((element) => {
            Object.assign(element.style, {
                position: 'fixed',
                inset: 'auto',
                margin: '0px',
                padding: '0px',
                border: '0px',
                background: 'transparent',
                boxSizing: 'border-box',
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: '9999',
            });
            const surface = element.querySelector('[data-isas-tooltip-content]');
            if (surface) surface.style.pointerEvents = 'auto';
            if (typeof element.showPopover !== 'function' && !this.state.open) {
                element.style.display = 'none';
            }
        });
    }

    syncProxyRect() {
        if (!this.overlay) return;
        const rect = this.el.getBoundingClientRect();
        this.overlayRuntime?.mutateHost((element) => {
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.style.width = `${rect.width}px`;
            element.style.height = `${rect.height}px`;
        });
    }

    syncDescribedBy(enabled) {
        const tokens = new Set(
            String(this.el.getAttribute('aria-describedby') ?? '')
                .split(/\s+/)
                .filter(Boolean),
        );
        if (enabled) tokens.add(this.overlayId);
        else tokens.delete(this.overlayId);

        this.runtime.mutateHost((element) => {
            if (tokens.size) element.setAttribute('aria-describedby', [...tokens].join(' '));
            else element.removeAttribute('aria-describedby');
        });
    }

    cancelClose() {
        if (this.closeTimer === null) return;
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }

    scheduleClose() {
        this.cancelClose();
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null;
            if (!this.triggerHovered
                && !this.triggerFocused
                && !this.overlayHovered
                && !this.overlayFocused) {
                this.close();
            }
        }, CLOSE_GRACE_MS);
    }

    open() {
        if (this.mode !== 'attachment' || !this.hasContent || this.state.open) return false;
        if (activeTooltip && activeTooltip !== this) activeTooltip.close();
        activeTooltip = this;
        this.cancelClose();
        this.state.open = true;
        this.setOverlayAttributes({
            open: '',
            'data-open': '',
        }, { render: true });
        this.applyPortalStyles();
        this.syncProxyRect();
        this.overlayRuntime?.mutateHost((element) => {
            element.style.setProperty('visibility', 'hidden', 'important');
            if (typeof element.showPopover === 'function') {
                try {
                    element.showPopover();
                    this.topLayerOpen = true;
                } catch {
                    this.topLayerOpen = false;
                    element.style.display = 'block';
                }
            } else {
                element.style.display = 'block';
            }
        });

        const onEscape = (event) => {
            if (event.key !== 'Escape' || !this.state.open) return;
            event.preventDefault();
            this.close();
        };
        document.addEventListener('keydown', onEscape, true);
        this.escapeCleanup = () => document.removeEventListener('keydown', onEscape, true);
        this.startPositioning();
        return true;
    }

    close() {
        if (this.mode !== 'attachment' || !this.state.open) return false;
        this.cancelClose();
        this.releasePositioning?.();
        this.releasePositioning = null;
        this.escapeCleanup?.();
        this.escapeCleanup = null;
        this.overlayHovered = false;
        this.overlayFocused = false;
        this.state.open = false;
        this.setOverlayAttributes({
            open: null,
            'data-open': null,
        }, { render: true });
        this.overlayRuntime?.mutateHost((element) => {
            element.style.visibility = 'hidden';
            if (this.topLayerOpen && typeof element.hidePopover === 'function') {
                try {
                    element.hidePopover();
                } catch {
                    element.style.display = 'none';
                }
            } else {
                element.style.display = 'none';
            }
        });
        this.topLayerOpen = false;
        if (activeTooltip === this) activeTooltip = null;
        return true;
    }

    startPositioning() {
        this.releasePositioning?.();
        const surface = this.overlay?.querySelector('[data-isas-tooltip-content]');
        if (!surface) return;
        this.releasePositioning = autoUpdate(
            this.el,
            surface,
            () => this.updatePosition(),
        );
    }

    updatePosition() {
        if (!this.state.open || !this.overlay) return Promise.resolve();

        this.syncProxyRect();
        const surface = this.overlay.querySelector('[data-isas-tooltip-content]');
        if (!surface) {
            this.overlayRuntime?.mutateHost((element) => {
                element.style.visibility = 'visible';
            });
            return Promise.resolve();
        }
        const arrowElement = surface.querySelector('[data-isas-floating-arrow]');
        const middleware = [
            offset(POSITION_GAP),
            flip({
                fallbackPlacements: this.fallbackPlacements(),
                fallbackStrategy: 'bestFit',
                flipAlignment: false,
            }),
        ];
        if (arrowElement) middleware.push(arrow({ element: arrowElement, padding: ARROW_PADDING }));

        return computePosition(this.el, surface, {
            placement: this.preferredPlacement(),
            strategy: 'fixed',
            middleware,
        }).then(({ placement, middlewareData }) => {
            if (!this.state.open || !this.overlay) return;

            this.applyResolvedPlacement(placement);
            this.overlayRuntime?.mutateHost((element) => {
                element.style.visibility = 'visible';
            });

            if (!arrowElement || !middlewareData.arrow) return;
            const { x: arrowX, y: arrowY } = middlewareData.arrow;
            const side = placement.split('-')[0];
            const staticSide = OPPOSITE_SIDE[side];
            Object.assign(arrowElement.style, {
                left: arrowX === undefined ? '' : `${arrowX}px`,
                top: arrowY === undefined ? '' : `${arrowY}px`,
                right: '',
                bottom: '',
            });
            if (staticSide) arrowElement.style[staticSide] = '-0.25rem';
        });
    }

    applyResolvedPlacement(placement) {
        const resolved = validPlacement(placement) ? placement : this.preferredPlacement();
        const side = placementSide(resolved);
        const isFlipped = side !== this.preferredSide();
        const changed = this.state.placement !== resolved
            || this.state.side !== side
            || this.state.isFlipped !== isFlipped;

        this.state.placement = resolved;
        this.state.side = side;
        this.state.isFlipped = isFlipped;
        this.setOverlayAttributes({
            placement: resolved,
            'data-placement': resolved,
            'data-side': side,
            'data-flipped': isFlipped ? '' : null,
        }, { render: changed });
        if (changed) {
            this.applyPortalStyles();
            this.syncProxyRect();
        }
    }

    attributeChanged(name) {
        if (this.mode === 'attachment'
            && (name === 'tooltip' || name.startsWith('tooltip:'))) {
            this.syncOverlay();
        }
    }

    sourceChanged() {
        if (this.mode === 'attachment') this.syncOverlay();
    }

    prepareRender() {
        const rich = hasVisibleContent(this.slots.get('default'));
        return {
            content: rich
                ? this.slots.get('default').html()
                : escapeHtml(this.attrs.get('content', '')),
        };
    }

    render() {
        const contentAttributes = this.attrs.for('content')
            .set('data-isas-tooltip-content', '');

        return `
            <div ${contentAttributes.toString()}>${this.view.content}</div>
        `;
    }

    destroy() {
        if (this.mode !== 'attachment') return;
        this.cancelClose();
        if (this.state?.open) this.close();
        this.syncDescribedBy(false);
        if (this.overlay?.isConnected) {
            globalThis.Alpine.destroyTree(this.overlay);
            this.overlay.remove();
        }
        if (this.overlay) delete this.overlay._x_teleportBack;
        this.overlayScopeCleanup?.();
        this.overlayScopeCleanup = null;
        this.overlay = null;
        this.overlayRuntime = null;
        if (activeTooltip === this) activeTooltip = null;
    }
}
