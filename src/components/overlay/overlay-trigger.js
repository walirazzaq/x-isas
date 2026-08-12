import { SurfaceTrigger } from '../surface/surface-trigger.js';

export class OverlayTrigger extends SurfaceTrigger {
    static activationAttribute = 'controls-overlay';
    static defaultNamespace = '$overlay';
    static targetKind = 'overlay';

    mergeScope() {
        return Object.defineProperties(super.mergeScope(), {
            mode: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.controller?.component.presentationMode() ?? 'adaptive';
                },
                set(value) {
                    this.controller?.component.setMode(value);
                },
            },
            breakpoint: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.controller?.component.breakpoint() ?? null;
                },
                set(value) {
                    this.controller?.component.setBreakpoint(value);
                },
            },
            closedBy: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.controller?.component.closedBy() ?? 'any';
                },
                set(value) {
                    this.controller?.component.setClosedBy(value);
                },
            },
        });
    }
}
