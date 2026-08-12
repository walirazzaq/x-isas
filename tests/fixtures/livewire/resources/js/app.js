import { autoInstall } from 'x-isas';
import 'x-isas/calendar';
import 'x-isas/upload';

const markReady = () => {
    document.documentElement.dataset.fixtureReady = 'true';
};

autoInstall();
document.addEventListener('livewire:initialized', markReady, { once: true });

if (globalThis.Livewire) markReady();
