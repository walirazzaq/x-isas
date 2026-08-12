import { Component } from './component.js';

export function normalizeName(name) {
    return String(name ?? '')
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
}

function validateAdapter(name, adapter) {
    if (typeof adapter === 'function') return;

    const isDescriptor = adapter !== null
        && typeof adapter === 'object'
        && !Array.isArray(adapter)
        && [Object.prototype, null].includes(Object.getPrototypeOf(adapter));

    if (!isDescriptor) {
        throw new Error(`Adapter '${name}' must be a function or a descriptor object.`);
    }

    if (adapter.attributes !== undefined && typeof adapter.attributes !== 'function') {
        throw new Error(`Adapter '${name}' descriptor attributes must be a function.`);
    }

    if (adapter.render !== undefined && typeof adapter.render !== 'function') {
        throw new Error(`Adapter '${name}' descriptor render must be a function.`);
    }

    if (typeof adapter.attributes !== 'function' && typeof adapter.render !== 'function') {
        throw new Error(
            `Adapter '${name}' descriptor requires an attributes or render function.`,
        );
    }
}

class Registry {

    constructor(kind, BaseClass) {
        this.kind = kind;
        this.BaseClass = BaseClass;
        this._entries = new Map();
        this._namesByClass = new Map();
    }

    register(name, Class) {
        const normalized = normalizeName(name);

        if (!normalized) {
            throw new Error(`${this.kind} registration requires a non-empty name.`);
        }

        if (typeof Class !== 'function' || !(Class.prototype instanceof this.BaseClass)) {
            throw new Error(`${this.kind} '${normalized}' must extend ${this.BaseClass.name}.`);
        }

        const existing = this._entries.get(normalized);

        if (existing) {
            if (existing === Class) {
                return this;
            }

            throw new Error(`${this.kind} '${normalized}' is already registered.`);
        }

        const existingName = this._namesByClass.get(Class);

        if (existingName && existingName !== normalized) {
            throw new Error(`${this.kind} class '${Class.name}' is already registered as '${existingName}'.`);
        }

        this._entries.set(normalized, Class);
        this._namesByClass.set(Class, normalized);
        return this;
    }

    get(name) {
        return this._entries.get(normalizeName(name)) ?? null;
    }

    ensure(name) {
        const normalized = normalizeName(name);
        const Class = this.get(normalized);

        if (!Class) {
            throw new Error(`${this.kind} '${normalized || name}' is not registered.`);
        }

        return { name: normalized, Class };
    }

    has(name) {
        return this._entries.has(normalizeName(name));
    }

    entries() {
        return [...this._entries.entries()];
    }
}

export class ComponentRegistry extends Registry {
    constructor() {
        super('Component', Component);
    }

    resolve(name) {
        const normalized = normalizeName(name);
        return {
            name: normalized,
            Class: this.get(normalized) ?? Component,
            registered: this.has(normalized),
        };
    }
}

export class AdapterRegistry {
    constructor() {
        this._entries = new Map();
    }

    register(name, adapter, { replace = false } = {}) {
        const normalized = normalizeName(name);

        if (!normalized) {
            throw new Error('Adapter registration requires a non-empty component name.');
        }

        validateAdapter(normalized, adapter);

        const existing = this._entries.get(normalized);

        if (existing) {
            if (existing === adapter) return this;
            if (!replace) throw new Error(`Adapter '${normalized}' is already registered.`);
        }

        this._entries.set(normalized, adapter);
        return this;
    }

    get(name) {
        return this._entries.get(normalizeName(name)) ?? null;
    }

    has(name) {
        return this._entries.has(normalizeName(name));
    }

    entries() {
        return [...this._entries.entries()];
    }
}
