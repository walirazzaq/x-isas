const registries = new WeakMap();

function stateFor(document) {
    let state = registries.get(document);
    if (!state) {
        state = { controllers: new Map(), subscribers: new Map() };
        registries.set(document, state);
    }
    return state;
}

function notify(state, id, controller) {
    for (const callback of state.subscribers.get(id) ?? []) callback(controller);
}

export const tabsRegistry = {
    register(controller) {
        const id = String(controller.id ?? '').trim();
        if (!id) return;
        const state = stateFor(controller.el.ownerDocument);
        const existing = state.controllers.get(id);
        if (existing && existing !== controller) {
            throw new Error(`Component 'tabs' id '${id}' is already registered.`);
        }
        state.controllers.set(id, controller);
        notify(state, id, controller);
    },

    unregister(controller) {
        const id = String(controller.id ?? '').trim();
        if (!id) return;
        const state = stateFor(controller.el.ownerDocument);
        if (state.controllers.get(id) !== controller) return;
        state.controllers.delete(id);
        notify(state, id, null);
    },

    resolve(document, id) {
        return stateFor(document).controllers.get(String(id ?? '').trim()) ?? null;
    },

    subscribe(document, id, callback) {
        const normalized = String(id ?? '').trim();
        const state = stateFor(document);
        let subscribers = state.subscribers.get(normalized);
        if (!subscribers) {
            subscribers = new Set();
            state.subscribers.set(normalized, subscribers);
        }
        subscribers.add(callback);
        callback(state.controllers.get(normalized) ?? null);

        return () => {
            subscribers.delete(callback);
            if (!subscribers.size) state.subscribers.delete(normalized);
        };
    },
};
