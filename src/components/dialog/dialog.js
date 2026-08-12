import { TargetComponent } from '../surface/target-component.js';

export class Dialog extends TargetComponent {
    static parts = {
        content: {
            tag: 'div',
        },
    };

    requiresContent = true;

    validateHost() {
        if (this.el.localName !== 'dialog') {
            throw new Error("Component 'dialog' requires an authored <dialog> host.");
        }
    }

    desiredPresentation() {
        return 'dialog';
    }

    mergeScope() {
        return Object.defineProperties(super.mergeScope(), {
            returnValue: {
                configurable: true,
                enumerable: true,
                get() {
                    return this.controller.returnValue;
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
}
