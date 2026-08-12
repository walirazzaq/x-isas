import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import isas from 'x-isas';
import 'x-isas/calendar';
import 'x-isas/upload';
import './app.css';

globalThis.Alpine = Alpine;
Alpine.plugin(morph);
Alpine.plugin(isas);
Alpine.start();

Alpine.nextTick(() => {
    document.documentElement.dataset.fixtureReady = 'true';
});
