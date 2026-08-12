const registries = new WeakMap();

function stateFor(document) {
    let state = registries.get(document);
    if (!state) {
        state = {
            targets: new Map(),
            subscribers: new Map(),
        };
        registries.set(document, state);
    }
    return state;
}

function keyFor(kind, id) {
    return `${kind}:${id}`;
}

function notify(state, key, controller) {
    for (const callback of state.subscribers.get(key) ?? []) callback(controller);
}

export const targetRegistry = {
    register(controller) {
        const state = stateFor(controller.el.ownerDocument);
        const key = keyFor(controller.kind, controller.id);
        const existing = state.targets.get(key);
        if (existing && existing !== controller) {
            throw new Error(
                `Component '${controller.kind}' target id '${controller.id}' is already registered.`,
            );
        }

        state.targets.set(key, controller);
        notify(state, key, controller);
    },

    unregister(controller) {
        const state = stateFor(controller.el.ownerDocument);
        const key = keyFor(controller.kind, controller.id);
        if (state.targets.get(key) !== controller) return;
        state.targets.delete(key);
        notify(state, key, null);
    },

    resolve(document, kind, id) {
        return stateFor(document).targets.get(keyFor(kind, id)) ?? null;
    },

    assertAvailable(document, kind, id, controller = null) {
        const existing = this.resolve(document, kind, id);
        if (existing && existing !== controller) {
            throw new Error(`Component '${kind}' target id '${id}' is already registered.`);
        }
    },

    subscribe(document, kind, id, callback) {
        const state = stateFor(document);
        const key = keyFor(kind, id);
        let subscribers = state.subscribers.get(key);
        if (!subscribers) {
            subscribers = new Set();
            state.subscribers.set(key, subscribers);
        }
        subscribers.add(callback);
        callback(state.targets.get(key) ?? null);

        return () => {
            subscribers.delete(callback);
            if (!subscribers.size) state.subscribers.delete(key);
        };
    },
};
