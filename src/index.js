import isas, { Isas } from './core.js';
import { installDaisyUIAdapters } from './adapters/daisyui/index.js';

installDaisyUIAdapters(Isas.adapters);

export default isas;
export * from './core.js';
export * from './adapters/daisyui/index.js';
