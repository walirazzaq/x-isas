import { display } from '../../display/display.js';
import { TargetComponent } from '../surface/target-component.js';

const MODES = new Set(['adaptive', 'dropdown', 'dialog']);

export class Overlay extends TargetComponent {
    static parts = {
        content: {
            tag: 'div',
        },
    };

    adaptive = true;
    requiresContent = true;

    presentationMode() {
        const value = String(this.attrs?.get('mode') ?? 'adaptive').toLowerCase();
        return MODES.has(value) ? value : 'adaptive';
    }

    breakpoint() {
        return this.attrs?.get('breakpoint')
            ?? display.state.mobileBreakpoint;
    }

    breakpointPixels() {
        const value = this.breakpoint();
        const numeric = Number.parseFloat(String(value).replace(/px$/i, ''));
        if (Number.isFinite(numeric) && /^\d+(?:\.\d+)?(?:px)?$/i.test(String(value))) {
            return Math.max(0, numeric);
        }

        return display.state.thresholds[String(value)]
            ?? display.state.thresholds[display.state.mobileBreakpoint]
            ?? 1024;
    }

    desiredPresentation(width = this.displayWidth()) {
        const mode = this.presentationMode();
        if (mode === 'dropdown' || mode === 'dialog') return mode;
        return width >= this.breakpointPixels() ? 'dropdown' : 'dialog';
    }

    defaultClosedBy() {
        return 'any';
    }

    mergeScope() {
        return Object.defineProperties(super.mergeScope(), {
            mode: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.presentationMode();
                },
                set(value) {
                    this.setMode(value);
                },
            },
            breakpoint: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.breakpoint();
                },
                set(value) {
                    this.setBreakpoint(value);
                },
            },
            closedBy: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.closedBy();
                },
                set(value) {
                    this.setClosedBy(value);
                },
            },
        });
    }

    displayWidth() {
        try {
            return display.state.width;
        } catch {
            return super.displayWidth();
        }
    }

    attributeChanged(name, oldValue, value) {
        super.attributeChanged(name, oldValue, value);
        if (['mode', 'breakpoint'].includes(name) || name.startsWith('dialog:')) {
            this.controller.reconcilePresentation();
            this.requestRender();
        }
    }
}
