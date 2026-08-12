/** Stable parent-level proxy for a nested component's Alpine namespace. */
export class NestedScopeBridge {
    constructor(component, {
        alias,
        componentName,
        safeMethods = [],
        fallbacks = {},
    }) {
        this.component = component;
        this.alias = alias;
        this.componentName = componentName;
        this.safeMethods = new Set(safeMethods);
        this.fallbacks = fallbacks;
        this.pending = new Map();
        this.methodProxies = new Map();
        this.state = globalThis.Alpine.reactive({ target: null });
        this.proxy = new Proxy({}, this.traps());
        this.cleanup = globalThis.Alpine.addScopeToNode(component.el, {
            [alias]: this.proxy,
        });
    }

    traps() {
        return {
            get: (_target, property) => {
                if (property === Symbol.toStringTag) return 'NestedScopeProxy';
                if (property === 'then') return undefined;

                const target = this.state.target;
                const value = target?.[property];
                if (typeof value === 'function' || this.safeMethods.has(property)) {
                    if (!this.methodProxies.has(property)) {
                        this.methodProxies.set(property, (...args) => {
                            const method = this.state.target?.[property];
                            return typeof method === 'function'
                                ? method(...args)
                                : false;
                        });
                    }
                    return this.methodProxies.get(property);
                }
                return target ? value : this.fallbacks[property];
            },
            set: (_target, property, value) => {
                const target = this.state.target;
                if (target) target[property] = value;
                else this.pending.set(property, value);
                return true;
            },
            has: (_target, property) => property in (this.state.target ?? {}),
            ownKeys: () => Reflect.ownKeys(this.state.target ?? {}),
            getOwnPropertyDescriptor: (_target, property) => {
                const descriptor = Object.getOwnPropertyDescriptor(
                    this.state.target ?? {},
                    property,
                );
                return descriptor ? { ...descriptor, configurable: true } : undefined;
            },
        };
    }

    connect(element) {
        const runtime = element
            ? this.component.runtime.constructor.from(element)
            : null;
        const nested = runtime?.componentFor(this.componentName);
        const namespace = runtime?.componentSpec?.namespace;
        const target = nested && namespace
            ? globalThis.Alpine.$data(element)?.[namespace]
            : null;

        if (!target) return false;
        this.state.target = target;
        for (const [property, value] of this.pending) target[property] = value;
        this.pending.clear();
        return true;
    }

    disconnect() {
        this.state.target = null;
    }

    destroy() {
        this.disconnect();
        this.pending.clear();
        this.cleanup?.();
        this.cleanup = null;
    }
}
