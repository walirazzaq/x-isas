import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import isas, {
    FileUpload,
    HostRuntime,
    Isas,
    fileUploadAdapter,
    uploadTransports,
} from '../src/upload.js';

const tick = async () => {
    await Promise.resolve();
    await Alpine.nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

function mount(html) {
    document.body.innerHTML = html;
    Alpine.initTree(document.body);
    return document.body.firstElementChild;
}

function component(host) {
    return HostRuntime.from(host).componentFor('file-upload');
}

beforeAll(() => {
    globalThis.Alpine = Alpine;
    Alpine.plugin(morph);
    Alpine.plugin(isas);
});

afterEach(async () => {
    Alpine.destroyTree(document.body);
    document.body.replaceChildren();
    delete globalThis.Livewire;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('file-upload opt-in entry and native selection', () => {
    it('registers only through the upload entry and renders inline by default', async () => {
        expect(Isas.components.get('file-upload')).toBe(FileUpload);
        expect(Isas.adapters.get('file-upload')).toBe(fileUploadAdapter);

        const host = mount('<div x-is="file-upload" name="documents[]" multiple></div>');
        await tick();

        const input = host.querySelector('[data-isas-file-upload-native]');
        expect(host.dataset.mode).toBe('inline');
        expect(host.dataset.transport).toBe('form');
        expect(input.type).toBe('file');
        expect(input.name).toBe('documents[]');
        expect(input.multiple).toBe(true);
        expect(host.querySelector('[data-isas-file-upload-dropzone]').getAttribute('role'))
            .toBe('button');
        expect(host.querySelector('[data-isas-file-upload-trigger]')).toBeNull();
    });

    it('keeps accepted files in the native FormData and exposes metadata', async () => {
        const form = mount(`
            <form>
                <div x-is="file-upload" name="documents[]" multiple></div>
            </form>
        `);
        await tick();
        const host = form.firstElementChild;
        const pdf = new File(['pdf'], 'guide.pdf', { type: 'application/pdf', lastModified: 10 });
        const image = new File(['image'], 'photo.png', { type: 'image/png', lastModified: 20 });

        expect(component(host).add([pdf, image])).toBe(true);
        await tick();

        const items = Alpine.$data(host).$fileUpload.items;
        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({
            name: 'guide.pdf',
            extension: 'PDF',
            category: 'pdf',
            status: 'queued',
        });
        expect(items[1].previewable).toBe(true);
        expect(host.querySelectorAll('[data-isas-file-upload-file]')).toHaveLength(2);
        expect(new FormData(form).getAll('documents[]').map((file) => file.name))
            .toEqual(['guide.pdf', 'photo.png']);
    });

    it('preserves the native input across renders and revokes previews on removal and reset', async () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const form = mount(`
            <form>
                <div x-is="file-upload" name="images[]" multiple></div>
            </form>
        `);
        await tick();
        const host = form.firstElementChild;
        component(host).add([new File(['image'], 'photo.png', { type: 'image/png' })]);
        await tick();
        const native = host.querySelector('[data-isas-file-upload-native]');
        const id = Alpine.$data(host).$fileUpload.items[0].id;

        component(host).requestRender();
        await tick();
        expect(host.querySelector('[data-isas-file-upload-native]')).toBe(native);
        expect(new FormData(form).get('images[]').name).toBe('photo.png');

        Alpine.$data(host).$fileUpload.remove(id);
        await tick();
        expect(revoke).toHaveBeenCalledOnce();

        component(host).add([new File(['image'], 'second.png', { type: 'image/png' })]);
        await tick();
        form.reset();
        await tick();
        expect(Alpine.$data(host).$fileUpload.count).toBe(0);
        expect(revoke).toHaveBeenCalledTimes(2);
    });

    it('rejects invalid types, oversize files, duplicates, and excessive counts', async () => {
        const host = mount(`
            <div x-is="file-upload" multiple accept="image/*" max-files="2"
                max-file-size="4"></div>
        `);
        await tick();
        const image = new File(['1234'], 'photo.png', { type: 'image/png', lastModified: 1 });
        const duplicate = new File(['1234'], 'photo.png', { type: 'image/png', lastModified: 1 });
        const text = new File(['x'], 'notes.txt', { type: 'text/plain' });
        const large = new File(['12345'], 'large.png', { type: 'image/png' });

        component(host).add([image]);
        await tick();
        component(host).add([duplicate, text, large]);
        await tick();

        const scope = Alpine.$data(host).$fileUpload;
        expect(scope.count).toBe(1);
        expect(scope.rejected).toHaveLength(3);
        expect(scope.rejected.flatMap((item) => item.errors)).toEqual(expect.arrayContaining([
            'This file has already been selected.',
            'This file type is not accepted.',
            'This file is too large.',
        ]));
        expect(scope.checkValidity()).toBe(false);
    });

    it('accepts an oversized selection after it is trimmed to max-files', async () => {
        const host = mount('<div x-is="file-upload" multiple max-files="3"></div>');
        await tick();
        component(host).add([
            new File(['a'], 'alpha.txt', { type: 'text/plain' }),
            new File(['b'], 'bravo.txt', { type: 'text/plain' }),
            new File(['c'], 'charlie.txt', { type: 'text/plain' }),
            new File(['d'], 'delta.txt', { type: 'text/plain' }),
        ]);
        await tick();

        const scope = Alpine.$data(host).$fileUpload;
        expect(scope.count).toBe(0);
        expect(scope.rejected).toHaveLength(4);
        const retainedIds = scope.rejected.slice(0, 3).map(({ id }) => id);

        scope.remove(scope.rejected[3].id);
        await tick();

        expect(scope.count).toBe(3);
        expect(scope.rejected).toHaveLength(0);
        expect(scope.items.map(({ name }) => name)).toEqual([
            'alpha.txt', 'bravo.txt', 'charlie.txt',
        ]);
        expect(scope.items.map(({ id }) => id)).toEqual(retainedIds);
        expect(scope.checkValidity()).toBe(true);
    });

    it('uses the full fingerprint for duplicates and can explicitly allow exact duplicates', async () => {
        const host = mount('<div x-is="file-upload" multiple></div>');
        await tick();
        component(host).add([new File(['a'], 'same.txt', { type: 'text/plain', lastModified: 1 })]);
        await tick();
        component(host).add([new File(['a'], 'same.txt', { type: 'text/plain', lastModified: 2 })]);
        await tick();
        expect(Alpine.$data(host).$fileUpload.count).toBe(2);

        host.setAttribute('allow-duplicates', '');
        await tick();
        component(host).add([new File(['a'], 'same.txt', { type: 'text/plain', lastModified: 2 })]);
        await tick();
        expect(Alpine.$data(host).$fileUpload.count).toBe(3);
        expect(Alpine.$data(host).$fileUpload.rejected).toHaveLength(0);
    });

    it('uses a scoped file template and supports list-to-grid part routing', async () => {
        const host = mount(`
            <div x-is="file-upload" multiple list:class="grid grid-cols-2">
                <template slot="file">
                    <article class="tile">
                        <strong x-text="$file.name"></strong>
                        <button type="button" @click="$file.remove()">Delete</button>
                    </article>
                </template>
            </div>
        `);
        await tick();
        component(host).add([new File(['a'], 'alpha.txt', { type: 'text/plain' })]);
        await tick();

        expect(host.querySelector('[data-isas-file-upload-list]').classList).toContain('grid-cols-2');
        expect(host.querySelector('.tile strong').textContent).toBe('alpha.txt');
        host.querySelector('.tile button').click();
        await tick();
        expect(Alpine.$data(host).$fileUpload.count).toBe(0);
    });

    it('renders a polished adaptive trigger and keeps direct picking opt-in', async () => {
        const host = mount('<div x-is="file-upload" mode="adaptive"></div>');
        await tick();
        const input = host.querySelector('[data-isas-file-upload-native]');
        const click = vi.spyOn(input, 'click');

        expect(host.querySelector('[data-isas-file-upload-trigger]')).not.toBeNull();
        expect(host.querySelector('[data-isas-file-upload-trigger-icon]')).toBeNull();
        expect(host.querySelector('[data-isas-file-upload-prepend] .i-tabler-paperclip')).not.toBeNull();
        expect(host.querySelector('[data-isas-file-upload-trigger]').textContent).toContain('Add files');
        expect(host.querySelector('[data-isas-file-upload-trigger]').getAttribute('aria-haspopup'))
            .not.toBe('listbox');
        expect(host.querySelector('[data-isas-file-upload-picker]')).toBeNull();
        expect(host.querySelector(`#${CSS.escape(component(host).overlayId)}`)).not.toBeNull();
        host.querySelector('[data-isas-file-upload-trigger]').click();
        await tick();
        expect(Alpine.$data(host).$fileUpload.open).toBe(true);
        Alpine.$data(host).$fileUpload.close();
        await tick();
        host.setAttribute('quick-add', '');
        await tick();
        host.querySelector('[data-isas-file-upload-picker]').click();
        await tick();
        expect(click).toHaveBeenCalledOnce();
    });

    it('groups records by status, derives constraint copy, and supports the flat escape hatch', async () => {
        const host = mount(`
            <div x-is="file-upload" multiple accept=".pdf,text/plain"
                max-file-size="4194304"></div>
        `);
        await tick();
        component(host).add([
            new File(['pdf'], 'guide.pdf', { type: 'application/pdf' }),
            new File(['image'], 'photo.png', { type: 'image/png' }),
        ]);
        await tick();

        expect(host.querySelector('[data-isas-file-upload-dropzone]').textContent)
            .toContain('PDF, TXT · Max 4 MB per file');
        expect(host.querySelector('[data-file-group="files"]')).not.toBeNull();
        expect(host.querySelector('[data-file-group="attention"]')).not.toBeNull();
        expect(Alpine.$data(host).$fileUpload.groups.map(({ key, count }) => [key, count]))
            .toEqual([['files', 1], ['attention', 1]]);
        expect(Alpine.$data(host).$fileUpload.items[1].attention).toBe(true);

        host.setAttribute('grouping', 'none');
        await tick();
        expect(host.querySelectorAll('[data-isas-file-upload-list]')).toHaveLength(1);
        expect(host.querySelector('[data-file-group]')).toBeNull();
    });

    it('renders a close-only dialog footer without clearing selected files', async () => {
        const host = mount('<div x-is="file-upload" mode="dialog" multiple></div>');
        await tick();
        component(host).add([new File(['a'], 'alpha.txt', { type: 'text/plain' })]);
        await tick();
        Alpine.$data(host).$fileUpload.show();
        await tick();

        expect(host.querySelector('[data-isas-file-upload-header]')).not.toBeNull();
        expect(host.querySelector('[data-isas-file-upload-done]')).not.toBeNull();
        host.querySelector('[data-isas-file-upload-done]').click();
        await tick();
        expect(Alpine.$data(host).$fileUpload.open).toBe(false);
        expect(Alpine.$data(host).$fileUpload.count).toBe(1);
    });
});

describe('file-upload transports', () => {
    it('implements the endpoint multipart/token protocol with progress', async () => {
        const requests = [];
        class FakeRequest extends EventTarget {
            constructor() {
                super();
                this.upload = new EventTarget();
                this.headers = {};
                requests.push(this);
            }

            open(method, url) {
                this.method = method;
                this.url = url;
            }

            setRequestHeader(name, value) {
                this.headers[name] = value;
            }

            send(body) {
                this.body = body;
                const progress = new Event('progress');
                Object.defineProperties(progress, {
                    loaded: { value: 5 },
                    total: { value: 10 },
                });
                this.upload.dispatchEvent(progress);
                this.status = 201;
                this.responseText = JSON.stringify({ token: 'server-token', jobId: 'job-1' });
                queueMicrotask(() => this.dispatchEvent(new Event('load')));
            }

            abort() {
                this.dispatchEvent(new Event('abort'));
            }
        }
        vi.stubGlobal('XMLHttpRequest', FakeRequest);
        const form = mount(`
            <form>
                <div x-is="file-upload" upload-url="/temporary-uploads"
                    upload-field="asset" name="attachments[]"></div>
            </form>
        `);
        await tick();
        const host = form.firstElementChild;
        component(host).add([new File(['payload'], 'report.txt', { type: 'text/plain' })]);
        await tick();
        await tick();

        expect(requests).toHaveLength(1);
        expect(requests[0]).toMatchObject({ method: 'POST', url: '/temporary-uploads' });
        expect(requests[0].body.get('asset').name).toBe('report.txt');
        expect(Alpine.$data(host).$fileUpload.items[0]).toMatchObject({
            status: 'uploaded',
            progress: 100,
            token: 'server-token',
            jobId: 'job-1',
        });
        expect(host.querySelector('[data-status="uploaded"] progress')).toBeNull();
        expect(new FormData(form).get('attachments[]')).toBe('server-token');
    });

    it('runs automatic custom uploads with bounded concurrency and token controls', async () => {
        const pending = [];
        let active = 0;
        let peak = 0;
        uploadTransports.register('test-bounded', () => ({
            start(record, { progress }) {
                active += 1;
                peak = Math.max(peak, active);
                progress(40);
                let resolve;
                const result = new Promise((done) => { resolve = done; }).finally(() => { active -= 1; });
                pending.push(() => resolve({ token: `token-${record.name}` }));
                return { result, cancel() {} };
            },
        }), { replace: true });

        const form = mount(`
            <form>
                <div x-is="file-upload" transport="test-bounded" concurrency="2"
                    name="tokens[]" multiple></div>
            </form>
        `);
        await tick();
        const host = form.firstElementChild;
        component(host).add([
            new File(['a'], 'a.txt'),
            new File(['b'], 'b.txt'),
            new File(['c'], 'c.txt'),
        ]);
        await tick();

        expect(peak).toBe(2);
        expect(Alpine.$data(host).$fileUpload.uploading).toHaveLength(2);
        pending.splice(0).forEach((resolve) => resolve());
        await tick();
        pending.splice(0).forEach((resolve) => resolve());
        await tick();

        expect(Alpine.$data(host).$fileUpload.uploaded).toHaveLength(3);
        expect(new FormData(form).getAll('tokens[]')).toEqual([
            'token-a.txt', 'token-b.txt', 'token-c.txt',
        ]);
        expect(host.querySelector('[data-isas-file-upload-native]').name).toBe('');
    });

    it('supports manual retry, cancellation, and per-file failures', async () => {
        let attempt = 0;
        uploadTransports.register('test-retry', () => ({
            start() {
                attempt += 1;
                let reject;
                const result = attempt === 1
                    ? Promise.reject(new Error('Rejected by endpoint.'))
                    : new Promise((resolve, fail) => { reject = fail; setTimeout(() => resolve({ token: 'ok' }), 0); });
                return {
                    result,
                    cancel: () => reject?.(new DOMException('Cancelled', 'AbortError')),
                };
            },
        }), { replace: true });
        const host = mount(`
            <div x-is="file-upload" transport="test-retry" upload-mode="manual"></div>
        `);
        await tick();
        component(host).add([new File(['x'], 'x.txt')]);
        await tick();
        const id = Alpine.$data(host).$fileUpload.items[0].id;

        expect(Alpine.$data(host).$fileUpload.upload(id)).toBe(true);
        await tick();
        expect(Alpine.$data(host).$fileUpload.file(id).status).toBe('error');
        expect(Alpine.$data(host).$fileUpload.retry(id)).toBe(true);
        await tick();
        expect(Alpine.$data(host).$fileUpload.file(id).status).toBe('uploaded');
    });

    it('uses managed Livewire uploads without forwarding wire:model to the native input', async () => {
        const calls = [];
        const removals = [];
        globalThis.Livewire = {
            find: () => ({
                upload(property, file, finish, error, progress) {
                    calls.push([property, file.name]);
                    progress({ detail: { progress: 65 } });
                    finish(`tmp-${file.name}`);
                },
                removeUpload(property, token, finish) {
                    removals.push([property, token]);
                    finish();
                },
                cancelUpload() {},
            }),
        };
        const root = mount(`
            <div wire:id="abc">
                <div x-is="file-upload" wire:model="photos" name="ignored" multiple></div>
            </div>
        `);
        await tick();
        const host = root.firstElementChild;
        component(host).add([
            new File(['a'], 'a.png', { type: 'image/png' }),
            new File(['b'], 'b.png', { type: 'image/png' }),
        ]);
        await tick();
        await tick();

        expect(calls).toEqual([['photos', 'a.png'], ['photos', 'b.png']]);
        expect(Alpine.$data(host).$fileUpload.uploaded).toHaveLength(2);
        expect(host.querySelector('[data-isas-file-upload-native]').hasAttribute('wire:model'))
            .toBe(false);

        const first = Alpine.$data(host).$fileUpload.items[0];
        first.remove();
        await tick();
        expect(removals).toEqual([['photos', 'tmp-a.png']]);
        expect(Alpine.$data(host).$fileUpload.count).toBe(1);
    });
});
