import { fieldAdapter } from './field.js';

export function selectFieldAdapter(context) {
    return fieldAdapter(context, 'select');
}
