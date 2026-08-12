import { SurfaceTrigger } from '../surface/surface-trigger.js';

export class DropdownTrigger extends SurfaceTrigger {
    static activationAttribute = 'controls-dropdown';
    static defaultNamespace = '$dropdown';
    static targetKind = 'dropdown';
}
