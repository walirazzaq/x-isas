import { SurfaceTrigger } from '../surface/surface-trigger.js';

export class DialogTrigger extends SurfaceTrigger {
    static activationAttribute = 'controls-dialog';
    static defaultNamespace = '$dialog';
    static targetKind = 'dialog';

    mergeScope() {
        return Object.defineProperties(super.mergeScope(), {
            returnValue: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.controller?.returnValue ?? '';
                },
            },
            closedBy: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.controller?.component.closedBy() ?? 'closerequest';
                },
                set(value) {
                    this.controller?.component.setClosedBy(value);
                },
            },
        });
    }
}
