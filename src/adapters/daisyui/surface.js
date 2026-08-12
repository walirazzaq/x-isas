const DROPDOWN_SIDES = new Set(['top', 'right', 'bottom', 'left']);
const DROPDOWN_ALIGNS = new Set(['start', 'center', 'end']);
const DIALOG_PLACEMENTS = new Set(['top', 'middle', 'bottom']);

export function dropdownClasses(component) {
    const [rawSide, rawAlign = 'center'] = String(
        component.controller?.state.resolvedPlacement
            ?? component.preferredDropdownPlacement(),
    ).split('-');
    const side = DROPDOWN_SIDES.has(rawSide) ? rawSide : 'bottom';
    const align = DROPDOWN_ALIGNS.has(rawAlign) ? rawAlign : 'center';

    return ['dropdown', `dropdown-${side}`, `dropdown-${align}`];
}

export function dialogPlacement(component, adaptive) {
    const scoped = adaptive ? component.attrs?.for('dialog').get('placement') : null;
    const raw = String(scoped ?? component.attrs?.get('placement') ?? (
        adaptive ? 'bottom' : 'middle'
    )).replace(/^modal-/, '');

    return DIALOG_PLACEMENTS.has(raw) ? raw : (adaptive ? 'bottom' : 'middle');
}

export function dropdownPresentation(component) {
    const classes = dropdownClasses(component);
    if (component.controller?.state.open) classes.push('dropdown-open');
    return {
        host: {
            class: classes,
        },
    };
}

export function dialogPresentation(component, { adaptive = false } = {}) {
    return {
        host: {
            class: ['modal', `modal-${dialogPlacement(component, adaptive)}`],
        },
        parts: {
            content: {
                class: 'modal-box',
            },
        },
    };
}
