import { dialogPresentation, dropdownPresentation } from './surface.js';

export function overlayAdapter({ component }) {
    return component.presentation === 'dialog'
        ? dialogPresentation(component, { adaptive: true })
        : dropdownPresentation(component);
}
