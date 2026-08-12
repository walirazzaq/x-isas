import { normalizeName } from '../../registries.js';

function wireModelBinding(element) {
    const attribute = element.getAttributeNames()
        .find((name) => name === 'wire:model' || name.startsWith('wire:model.'));
    return attribute ? element.getAttribute(attribute) : null;
}

function livewireComponent(element) {
    const root = element.closest('[wire\\:id]');
    const id = root?.getAttribute('wire:id');
    return id && globalThis.Livewire?.find ? globalThis.Livewire.find(id) : null;
}

function progressValue(event) {
    if (Number.isFinite(event?.detail?.progress)) return event.detail.progress;
    if (Number.isFinite(event?.loaded) && Number.isFinite(event?.total) && event.total > 0) {
        return Math.round((event.loaded / event.total) * 100);
    }
    return 0;
}

export class UploadTransportRegistry {
    constructor() {
        this._entries = new Map();
    }

    register(name, factory, { replace = false } = {}) {
        const normalized = normalizeName(name);
        if (!normalized) throw new Error('Upload transport registration requires a name.');
        if (typeof factory !== 'function' && (factory === null || typeof factory !== 'object')) {
            throw new Error(`Upload transport '${normalized}' must be a factory or transport object.`);
        }
        if (this._entries.has(normalized) && this._entries.get(normalized) !== factory && !replace) {
            throw new Error(`Upload transport '${normalized}' is already registered.`);
        }
        this._entries.set(normalized, factory);
        return this;
    }

    get(name) {
        return this._entries.get(normalizeName(name)) ?? null;
    }

    create(name, context) {
        const factory = this.get(name);
        if (!factory) throw new Error(`Upload transport '${normalizeName(name) || name}' is not registered.`);
        const transport = typeof factory === 'function' ? factory(context) : factory;
        if (!transport || typeof transport.start !== 'function') {
            throw new Error(`Upload transport '${name}' must provide start(record, callbacks).`);
        }
        return transport;
    }

    entries() {
        return [...this._entries.entries()];
    }
}

export function createLivewireTransport({ component }) {
    const property = wireModelBinding(component.el);
    const wire = livewireComponent(component.el);
    if (!property || !wire?.upload) {
        throw new Error("FileUpload Livewire transport requires wire:model and an owning Livewire component.");
    }

    return {
        concurrency: 1,
        start(record, { progress }) {
            let cancelled = false;
            let resolveResult;
            let rejectResult;
            const result = new Promise((resolve, reject) => {
                resolveResult = resolve;
                rejectResult = reject;
            });
            wire.upload(
                property,
                record.file,
                (token) => resolveResult({ token }),
                () => rejectResult(new Error('The file failed to upload.')),
                (event) => progress(progressValue(event), event?.loaded, event?.total),
                () => {
                    cancelled = true;
                    rejectResult(new DOMException('Upload cancelled.', 'AbortError'));
                },
            );
            return {
                result,
                cancel() {
                    if (cancelled) return;
                    cancelled = true;
                    wire.cancelUpload?.(property);
                },
            };
        },
        remove(result) {
            if (!result?.token || !wire.removeUpload) return Promise.resolve();
            return new Promise((resolve, reject) => {
                wire.removeUpload(property, result.token, resolve, reject);
            });
        },
    };
}

function responseError(xhr) {
    try {
        const payload = JSON.parse(xhr.responseText || '{}');
        const errors = payload.errors && typeof payload.errors === 'object'
            ? Object.values(payload.errors).flat()
            : [];
        return new Error(errors[0] ?? payload.message ?? `Upload failed with status ${xhr.status}.`);
    } catch {
        return new Error(`Upload failed with status ${xhr.status}.`);
    }
}

export function createEndpointTransport({ component }) {
    const url = String(component.attrs.get('upload-url') ?? '').trim();
    if (!url) throw new Error('FileUpload endpoint transport requires upload-url.');
    const field = String(component.attrs.get('upload-field') ?? 'file');

    return {
        start(record, { progress }) {
            const xhr = new XMLHttpRequest();
            const result = new Promise((resolve, reject) => {
                xhr.open('POST', url);
                try {
                    xhr.withCredentials = new URL(url, document.baseURI).origin === location.origin;
                } catch {
                    xhr.withCredentials = false;
                }
                xhr.setRequestHeader('Accept', 'application/json');
                const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
                if (csrf) xhr.setRequestHeader('X-CSRF-TOKEN', csrf);
                xhr.upload.addEventListener('progress', (event) => {
                    progress(progressValue(event), event.loaded, event.total);
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status < 200 || xhr.status >= 300) {
                        reject(responseError(xhr));
                        return;
                    }
                    try {
                        const payload = JSON.parse(xhr.responseText || '{}');
                        if (!payload.token) throw new Error('Upload response must contain a token.');
                        resolve(payload);
                    } catch (error) {
                        reject(error);
                    }
                });
                xhr.addEventListener('error', () => reject(new Error('The upload network request failed.')));
                xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled.', 'AbortError')));
                const body = new FormData();
                body.append(field, record.file, record.name);
                xhr.send(body);
            });
            return {
                result,
                cancel: () => xhr.abort(),
            };
        },
        async remove(result) {
            if (!result?.deleteUrl) return;
            const headers = { Accept: 'application/json' };
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
            if (csrf) headers['X-CSRF-TOKEN'] = csrf;
            await fetch(result.deleteUrl, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers,
            });
        },
    };
}

export const uploadTransports = new UploadTransportRegistry();
uploadTransports.register('livewire', createLivewireTransport);
uploadTransports.register('endpoint', createEndpointTransport);

export { wireModelBinding };
