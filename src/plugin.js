import {
    HostRuntime,
    hasParentRuntime,
} from './host-runtime.js';
import { Isas } from './isas.js';
import { installDisplayMagic } from './display/alpine.js';
import {
    ATTACHMENT_SELECTOR,
    COMPONENT_SELECTOR,
    hasComponentDirective,
} from './support/directives.js';
import { camelCase, isPlainObject } from './support/value.js';

const INSTALLED = Symbol.for('x-isas.installed');
const LIVEWIRE_BRIDGE = Symbol.for('x-isas.livewire-bridge');
const IDENTIFIER = /^[$A-Z_a-z][$\w]*$/;
const HOST_NAMESPACE = '$host';
let autoInstallCleanup = null;

export function parseComponentSpec(expression, registry = Isas.components) {
    const value = String(expression ?? '').trim();
    const separator = value.indexOf(':');
    const rawName = separator === -1 ? value : value.slice(0, separator);
    const explicitNamespace = separator === -1 ? null : value.slice(separator + 1);

    if (!rawName) throw new Error('x-is requires a literal component name.');
    if (explicitNamespace !== null && !IDENTIFIER.test(explicitNamespace)) {
        throw new Error(`x-is namespace '${explicitNamespace}' must be a valid JavaScript identifier.`);
    }

    const descriptor = registry.resolve(rawName);
    const namespace = explicitNamespace
        ?? descriptor.Class.defaultNamespace
        ?? `$${camelCase(descriptor.name)}`;
    if (namespace === HOST_NAMESPACE) {
        throw new Error(`x-isas namespace '${HOST_NAMESPACE}' is reserved for the host scope.`);
    }

    return {
        ...descriptor,
        namespace,
    };
}

function parseAttachmentSpec(expression, registry) {
    const value = String(expression ?? '').trim();
    const separator = value.indexOf(':');
    const rawName = separator === -1 ? value : value.slice(0, separator);
    const explicitNamespace = separator === -1 ? null : value.slice(separator + 1);

    if (!rawName) throw new Error('x-as requires a literal component name.');
    if (explicitNamespace !== null && !IDENTIFIER.test(explicitNamespace)) {
        throw new Error(`x-as namespace '${explicitNamespace}' must be a valid JavaScript identifier.`);
    }

    const descriptor = registry.ensure(rawName);
    if (descriptor.Class.attachable !== true) {
        throw new Error(`Component '${descriptor.name}' is not attachable through x-as.`);
    }

    const namespace = explicitNamespace
        ?? descriptor.Class.defaultNamespace
        ?? `$${camelCase(descriptor.name)}`;
    if (namespace === HOST_NAMESPACE) {
        throw new Error(`x-isas namespace '${HOST_NAMESPACE}' is reserved for the host scope.`);
    }

    return { ...descriptor, namespace };
}

export function normalizeAttachmentSpec(value, registry = Isas.components, scopeOverride = null) {
    let entries;

    if (value === '' || value === null || value === undefined) {
        entries = [];
    } else if (typeof value === 'string') {
        entries = [[value, {}]];
    } else if (Array.isArray(value)) {
        entries = value.map((name) => {
            if (typeof name !== 'string' || !name.trim()) {
                throw new Error('x-as arrays must contain non-empty component specifications.');
            }
            return [name, {}];
        });
    } else if (isPlainObject(value)) {
        entries = Object.entries(value);
    } else {
        throw new Error('x-as must be a component name, an array of names, or an object of component configs.');
    }

    const names = new Set();
    const namespaces = new Set();
    const normalized = [];
    for (const [specification, config] of entries) {
        const descriptor = parseAttachmentSpec(specification, registry);
        if (!isPlainObject(config)) {
            throw new Error(`x-as component '${descriptor.name}' requires a plain configuration object.`);
        }

        if (names.has(descriptor.name)) {
            throw new Error(`x-as component '${descriptor.name}' cannot be attached more than once.`);
        }
        if (namespaces.has(descriptor.namespace)) {
            throw new Error(`x-as namespace '${descriptor.namespace}' is already in use.`);
        }
        names.add(descriptor.name);
        namespaces.add(descriptor.namespace);
        normalized.push({
            ...descriptor,
            name: descriptor.name,
            namespace: descriptor.namespace,
            config: Object.freeze({ ...config }),
            scoped: scopeOverride ?? descriptor.Class.scoped !== false,
        });
    }

    return normalized;
}

function evaluateAttachmentExpression(expression, evaluate) {
    const value = String(expression ?? '').trim();
    if (!value) return '';
    return value.startsWith('[') || value.startsWith('{') ? evaluate(value) : value;
}

function scopeOverrideFor(modifiers, directive) {
    const supported = new Set(['scoped', 'unscoped']);
    const unknown = modifiers.filter((modifier) => !supported.has(modifier));
    if (unknown.length) {
        throw new Error(`${directive} does not support modifier '.${unknown[0]}'.`);
    }
    if (modifiers.includes('scoped') && modifiers.includes('unscoped')) {
        throw new Error(`${directive} cannot use both '.scoped' and '.unscoped'.`);
    }
    if (modifiers.includes('scoped')) return true;
    if (modifiers.includes('unscoped')) return false;
    return null;
}

function initializeRenderedChildren(el) {
    queueMicrotask(() => {
        if (!el.isConnected) return;
        for (const child of el.children) globalThis.Alpine.initTree(child);
    });
}

function destroyRemovedRuntimes(el) {
    const selector = `${COMPONENT_SELECTOR}, ${ATTACHMENT_SELECTOR}`;
    const elements = [];

    if (el?.matches?.(selector)) elements.push(el);
    if (el?.querySelectorAll) elements.push(...el.querySelectorAll(selector));

    for (const element of elements.reverse()) {
        HostRuntime.from(element)?.destroy();
    }
}

function refreshAddedRuntimeElements(root) {
    if (root?.nodeType !== Node.ELEMENT_NODE) return;
    const selector = `${COMPONENT_SELECTOR}, ${ATTACHMENT_SELECTOR}`;
    const elements = [
        ...(root.matches(selector) ? [root] : []),
        ...root.querySelectorAll(selector),
    ];

    for (const element of elements) {
        if (!element.isConnected) continue;
        const runtime = HostRuntime.from(element);
        if (runtime?.component || runtime?.attachments?.size) {
            runtime.renderNow();
            continue;
        }
        delete element._x_marker;
        globalThis.Alpine.initTree(element);
    }
}

function installLivewireBridge() {
    if (typeof window === 'undefined' || window[LIVEWIRE_BRIDGE]) return;
    window[LIVEWIRE_BRIDGE] = true;

    window.addEventListener('livewire:init', () => {
        const Livewire = globalThis.Livewire;
        if (!Livewire?.hook) return;

        Livewire.hook('morph.updating', (payload) => {
            const runtime = HostRuntime.from(payload.el);
            if (!runtime || hasParentRuntime(payload.el, payload.component?.el)) return;
            if (runtime.component?.constructor.structural !== true) {
                runtime.adoptSource(payload.toEl, { render: false });
                if (runtime.component?.constructor.preserveHostDuringMorph === true) {
                    payload.childrenOnly?.();
                    queueMicrotask(() => {
                        if (!runtime.destroyed) runtime.renderNow();
                    });
                }
                return;
            }
            runtime.reconcileFrom(payload.toEl);
            payload.skip?.();
        });

        Livewire.hook('morph.removing', ({ el }) => {
            destroyRemovedRuntimes(el);
        });

        Livewire.hook('morph.added', ({ el }) => {
            queueMicrotask(() => refreshAddedRuntimeElements(el));
        });

        Livewire.hook('island.morphed', ({ startNode, endNode }) => {
            queueMicrotask(() => {
                let node = startNode?.nextSibling;
                while (node && node !== endNode) {
                    refreshAddedRuntimeElements(node);
                    node = node.nextSibling;
                }
            });
        });
    });
}

/** Alpine plugin that installs x-is and x-as. */
export default function isas(Alpine) {
    if (Alpine[INSTALLED]) return;
    Alpine[INSTALLED] = true;
    installDisplayMagic(Alpine);
    installLivewireBridge();
    Alpine.addRootSelector(() => `${COMPONENT_SELECTOR}, ${ATTACHMENT_SELECTOR}`);
    Alpine.interceptInit((el, skip) => {
        if (el.matches(`${COMPONENT_SELECTOR}, ${ATTACHMENT_SELECTOR}`)) skip();
    });

    Alpine.directive('is', Alpine.skipDuringClone((el, { expression, modifiers }, { cleanup }) => {
        const runtime = HostRuntime.for(el);
        const scopeOverride = scopeOverrideFor(modifiers, 'x-is');
        const descriptor = parseComponentSpec(expression);
        runtime.configureComponent({
            ...descriptor,
            scoped: scopeOverride ?? descriptor.Class.scoped !== false,
        });
        const release = runtime.retain();
        cleanup(() => {
            runtime.removeComponent();
            release();
        });
        runtime.boot();
        initializeRenderedChildren(el);
    })).before('bind');

    Alpine.directive('as', Alpine.skipDuringClone((el, { expression, modifiers }, { evaluate, cleanup }) => {
        const runtime = HostRuntime.for(el);
        const scopeOverride = scopeOverrideFor(modifiers, 'x-as');
        const value = evaluateAttachmentExpression(expression, evaluate);
        runtime.configureAttachments(normalizeAttachmentSpec(value, Isas.components, scopeOverride));
        const release = runtime.retain();
        cleanup(() => {
            runtime.removeExplicitAttachments();
            release();
        });
        if (!hasComponentDirective(el)) {
            runtime.boot();
            initializeRenderedChildren(el);
        }
    })).before('is');

    Alpine.directive('part', Alpine.skipDuringClone((el, { expression, value }, { cleanup }) => {
        if (value) throw new Error('x-part does not accept directive values or dynamic names.');
        const owner = HostRuntime.from(el.parentElement);
        if (!owner) throw new Error('x-part requires a direct x-is parent.');
        cleanup(owner.connectPart(el, expression));
    })).before('bind');
}

export function install() {
    const Alpine = globalThis.Alpine;
    if (Alpine[INSTALLED]) return false;
    Alpine.plugin(isas);
    installLivewireBridge();
    return true;
}

export function autoInstall() {
    if (globalThis.Alpine) install();
    installLivewireBridge();

    if (typeof document === 'undefined') return () => {};
    if (autoInstallCleanup) return autoInstallCleanup;

    const onInit = () => install();
    document.addEventListener('alpine:init', onInit);
    autoInstallCleanup = () => {
        document.removeEventListener('alpine:init', onInit);
        autoInstallCleanup = null;
    };
    return autoInstallCleanup;
}
