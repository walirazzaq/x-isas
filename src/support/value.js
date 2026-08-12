export function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function camelCase(value) {
    return String(value).replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
}
