import { display } from './display.js';

/** Install the shared display service and expose it as Alpine's $display magic. */
export function installDisplayMagic(Alpine) {
    display.install(Alpine);
    Alpine.magic('display', () => display.state);
}
