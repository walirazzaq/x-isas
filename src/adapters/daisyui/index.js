import { Isas } from '../../isas.js';
import { alertAdapter } from './alert.js';
import { avatarAdapter } from './avatar.js';
import { badgeAdapter } from './badge.js';
import { buttonAdapter } from './button.js';
import { cardAdapter } from './card.js';
import { chatAdapter } from './chat.js';
import { countdownAdapter } from './countdown.js';
import { dialogAdapter } from './dialog.js';
import { dividerAdapter } from './divider.js';
import { dockAdapter } from './dock.js';
import { dropdownAdapter } from './dropdown.js';
import { inputAdapter } from './input.js';
import { inputFieldAdapter } from './input-field.js';
import { listAdapter } from './list.js';
import { menuAdapter } from './menu.js';
import { optionAdapter } from './option.js';
import { otpAdapter } from './otp.js';
import { overlayAdapter } from './overlay.js';
import { progressAdapter } from './progress.js';
import { radialProgressAdapter } from './radial-progress.js';
import { selectAdapter } from './select.js';
import { selectFieldAdapter } from './select-field.js';
import { stepsAdapter } from './steps.js';
import { statsAdapter } from './stats.js';
import { tabsAdapter } from './tabs.js';
import { timelineAdapter } from './timeline.js';
import { tooltipAdapter } from './tooltip.js';

export const daisyUIAdapters = Object.freeze({
    alert: alertAdapter,
    avatar: avatarAdapter,
    badge: badgeAdapter,
    button: buttonAdapter,
    card: cardAdapter,
    chat: chatAdapter,
    countdown: countdownAdapter,
    dialog: dialogAdapter,
    divider: dividerAdapter,
    dock: dockAdapter,
    dropdown: dropdownAdapter,
    input: inputAdapter,
    'input-field': inputFieldAdapter,
    list: listAdapter,
    menu: menuAdapter,
    option: optionAdapter,
    otp: otpAdapter,
    overlay: overlayAdapter,
    progress: progressAdapter,
    'radial-progress': radialProgressAdapter,
    select: selectAdapter,
    'select-field': selectFieldAdapter,
    steps: stepsAdapter,
    stats: statsAdapter,
    tabs: tabsAdapter,
    timeline: timelineAdapter,
    tooltip: tooltipAdapter,
});

export function installDaisyUIAdapters(registry = Isas.adapters) {
    for (const [name, adapter] of Object.entries(daisyUIAdapters)) {
        registry.register(name, adapter);
    }

    return registry;
}

export {
    alertAdapter,
    avatarAdapter,
    badgeAdapter,
    buttonAdapter,
    cardAdapter,
    chatAdapter,
    countdownAdapter,
    dialogAdapter,
    dividerAdapter,
    dockAdapter,
    dropdownAdapter,
    inputAdapter,
    inputFieldAdapter,
    listAdapter,
    menuAdapter,
    optionAdapter,
    otpAdapter,
    overlayAdapter,
    progressAdapter,
    radialProgressAdapter,
    selectAdapter,
    selectFieldAdapter,
    stepsAdapter,
    statsAdapter,
    tabsAdapter,
    timelineAdapter,
    tooltipAdapter,
};
