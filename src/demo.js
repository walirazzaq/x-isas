import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import isas, { Component, Isas } from './index.js';

class DemoStatus extends Component {
    static attachable = true;

    mergeScope() {
        return { describe: () => `attached:${this.attrs.get('status')}` };
    }
}

Isas.components.register('demo-status', DemoStatus);

globalThis.Alpine = Alpine;
Alpine.plugin(morph);
Alpine.plugin(isas);
Alpine.start();
