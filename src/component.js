/** Base component. Unknown x-is names use this pass-through renderer. */
export class Component {
    static attachable = false;
    static activationAttribute = null;
    static defaultNamespace = null;
    static scoped = true;
    static structural = false;
    static stableSlots = [];
    static parts = {};

    _initialize({ el, runtime, name, namespace, mode = 'primary', config = {} }) {
        this.el = el;
        this.runtime = runtime;
        this.name = name;
        this.namespace = namespace;
        this.mode = mode;
        this.config = config;
        this.attrs = null;
        this.slots = null;
        this.parts = null;
        this.source = null;
        this.view = undefined;
        this._generatedPartAttributes = {};
        this._cleanups = [];
    }

    _setRenderContext({ attrs, slots, parts, source }) {
        this.attrs = attrs;
        this.slots = slots;
        this.parts = parts;
        this.source = source;
        this.view = undefined;
    }

    _prepareRenderContext() {
        this.view = this.prepareRender({
            attrs: this.attrs,
            slots: this.slots,
            parts: this.parts,
        });
        return this.view;
    }

    reactive(value) {
        return globalThis.Alpine.reactive(value);
    }

    component(name) {
        return this.runtime.componentFor(name);
    }

    owner(name) {
        return this.runtime.closestComponent(name);
    }

    requestRender() {
        this.runtime.requestRender();
    }

    generatedPartAttributes(name) {
        return this._generatedPartAttributes?.[name]?.clone();
    }

    onCleanup(callback) {
        if (typeof callback === 'function') this._cleanups.push(callback);
        return callback;
    }

    listen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this.onCleanup(() => target.removeEventListener(type, listener, options));
        return listener;
    }

    _cleanup() {
        for (const callback of this._cleanups.splice(0).reverse()) callback();
    }

    mount() {}
    /** Members merged into this component's Alpine namespace after mount. */
    mergeScope() { return {}; }
    attributeChanged() {}
    sourceChanged() {}
    prepareRender() { return undefined; }
    hostAttributes() { return {}; }
    render() { return undefined; }
    destroy() {}
}
