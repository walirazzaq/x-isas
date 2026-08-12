import { NestedScopeBridge } from '../field/nested-scope-bridge.js';

export class InputScopeBridge extends NestedScopeBridge {
    constructor(component) {
        super(component, {
            alias: '$input',
            componentName: 'input',
            safeMethods: ['clear', 'showError'],
        });
    }
}
