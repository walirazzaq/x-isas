import { Component } from '../../component.js';
import { visibleNodes } from '../../support/html.js';
import { prepareAccessories } from '../../support/render-accessories.js';
import { FileUploadDriver } from './file-upload-driver.js';
import { FileUploadView } from './file-upload-view.js';
import {
    fileCategory,
    fileExtension,
    fileFingerprint,
    formatFileSize,
    normalizeFileErrors,
} from './records.js';
import { uploadTransports, wireModelBinding } from './transports.js';

let nextUploadId = 0;
let nextRecordId = 0;
const MODES = new Set(['inline', 'adaptive', 'dropdown', 'dialog']);
const MIME_LABELS = Object.freeze({
    'application/pdf': 'PDF',
    'application/json': 'JSON',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
});

function integerAttribute(attrs, name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const value = Number.parseInt(attrs.get(name), 10);
    return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export class FileUpload extends Component {
    static structural = true;
    static preserveHostDuringMorph = true;
    static stableSlots = [
        'file', 'value', 'prepend', 'append', 'dropzone', 'empty', 'error',
        'dialog-title', 'description', 'header-actions', 'files-label',
        'attention-label', 'footer',
    ];

    mount() {
        this.uploadId = this.el.id || `x-isas-file-upload-${++nextUploadId}`;
        this.overlayId = `${this.uploadId}-overlay`;
        this.titleId = `${this.overlayId}-title`;
        this.fileTemplate = this.resolveFileTemplate();
        this.facades = new Map();
        this.previewCleanups = new Map();
        this.tasks = new Map();
        this.transport = null;
        this.transportKey = '';
        this.activeUploads = 0;
        this.reconcileQueued = false;
        this.syncingModel = false;
        this.formControl = null;
        this.formBinding = null;
        this.overlayBinding = null;
        this.ownedValidityMessage = '';
        this.customValidityMessage = '';
        this.suppressRemoteRemoval = false;
        this.livewireHadValue = false;
        this.renderer = new FileUploadView(this);
        this.state = this.reactive({
            records: [],
            validationVisible: false,
            validationMessage: '',
            open: false,
            presentation: this.modeValue() === 'dialog' ? 'dialog' : 'dropdown',
        });
        this.driver = new FileUploadDriver(this, this.uploadId);
        this.listen(this.el, 'click', (event) => this.handleClick(event));
        queueMicrotask(() => queueMicrotask(() => this.initializeModel()));
    }

    modeValue() {
        const value = String(this.attrs?.get('mode') ?? 'inline').toLowerCase();
        return MODES.has(value) ? value : 'inline';
    }

    transportName() {
        const configured = String(this.attrs?.get('transport') ?? 'auto').toLowerCase();
        if (configured !== 'auto') return configured;
        if (wireModelBinding(this.el)) return 'livewire';
        if (String(this.attrs?.get('upload-url') ?? '').trim()) return 'endpoint';
        return 'form';
    }

    isAsync() {
        const name = this.transportName();
        return name !== 'form';
    }

    automaticUpload() {
        return String(this.attrs?.get('upload-mode') ?? 'automatic').toLowerCase() !== 'manual';
    }

    maxFiles() {
        if (!this.attrs.boolean('multiple')) return 1;
        return integerAttribute(this.attrs, 'max-files', 999999, 1);
    }

    locale() {
        return String(this.attrs?.get('locale') ?? document.documentElement.lang ?? 'en-US') || 'en-US';
    }

    allowDrop() {
        return !this.attrs.has('allow-drop') || this.attrs.boolean('allow-drop');
    }

    groupingValue() {
        return String(this.attrs?.get('grouping') ?? 'status').toLowerCase() === 'none'
            ? 'none'
            : 'status';
    }

    quickAdd() {
        return this.attrs.boolean('quick-add') || this.slots.get('append').filled();
    }

    acceptText() {
        const value = String(this.attrs.get('accept') ?? '').trim();
        if (!value) return '';
        const labels = value.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
            const normalized = entry.toLowerCase();
            if (normalized.startsWith('.')) return normalized.slice(1).toUpperCase();
            if (MIME_LABELS[normalized]) return MIME_LABELS[normalized];
            if (normalized.endsWith('/*')) {
                const category = normalized.slice(0, -2);
                return `${category.charAt(0).toUpperCase()}${category.slice(1)}s`;
            }
            const subtype = normalized.split('/')[1];
            return subtype ? subtype.replace(/^x-/, '').toUpperCase() : entry;
        });
        return [...new Set(labels)].join(', ');
    }

    supportText() {
        const authored = this.attrs.get('support');
        if (authored) return String(authored);
        const parts = [];
        const accepts = this.acceptText();
        if (accepts) parts.push(accepts);
        if (this.attrs.has('max-file-size')) {
            const bytes = integerAttribute(this.attrs, 'max-file-size', 0, 0);
            if (bytes) parts.push(`Max ${formatFileSize(bytes, this.locale())} per file`);
        }
        return parts.join(' · ') || 'Select files from your device';
    }

    recordGroups() {
        const attention = new Set(['rejected', 'error', 'cancelled']);
        return [
            {
                key: 'files',
                records: this.state.records.filter((record) => !attention.has(record.status)),
            },
            {
                key: 'attention',
                records: this.state.records.filter((record) => attention.has(record.status)),
            },
        ];
    }

    publicGroups() {
        return this.recordGroups().map((group) => Object.freeze({
            key: group.key,
            count: group.records.length,
            items: group.records.map((record) => this.fileFacade(record.id)),
        }));
    }

    isDisabled() {
        return this.attrs?.boolean('disabled') || this.el.hasAttribute('disabled');
    }

    isReadOnly() {
        return this.attrs?.boolean('readonly') || this.el.hasAttribute('readonly');
    }

    machineProps(id) {
        return {
            id,
            ids: {
                root: this.uploadId,
                hiddenInput: `${this.uploadId}-native`,
                dropzone: `${this.uploadId}-dropzone`,
                trigger: `${this.uploadId}-picker`,
            },
            name: this.transportName() === 'form' ? this.attrs.get('name') ?? undefined : undefined,
            accept: this.attrs.get('accept') ?? undefined,
            capture: this.attrs.get('capture') ?? undefined,
            directory: this.attrs.boolean('directory'),
            disabled: this.isDisabled(),
            readOnly: this.isReadOnly(),
            required: this.attrs.boolean('required'),
            allowDrop: this.allowDrop(),
            preventDocumentDrop: !this.attrs.has('prevent-document-drop')
                || this.attrs.boolean('prevent-document-drop'),
            maxFiles: this.maxFiles(),
            minFileSize: integerAttribute(this.attrs, 'min-file-size', 0, 0),
            maxFileSize: integerAttribute(
                this.attrs,
                'max-file-size',
                Number.MAX_SAFE_INTEGER,
                0,
            ),
            locale: this.locale(),
            invalid: this.state?.validationVisible,
            translations: {
                dropzone: String(this.attrs.get('dropzone-label') ?? 'Choose files or drop them here'),
                deleteFile: (file) => `Remove ${file.name}`,
                itemPreview: (file) => `Preview of ${file.name}`,
            },
            onFileChange: () => this.queueFileReconcile(),
        };
    }

    initializeModel() {
        if (!this.el.isConnected) return;
        if (wireModelBinding(this.el)) {
            this.startLivewireModelEffect();
            return;
        }
        const model = this.el._x_model;
        const initial = model?.get?.();
        if (Array.isArray(initial) && initial.every((file) => file instanceof File)) {
            this.driver.api.setFiles(initial);
        }
        const Alpine = globalThis.Alpine;
        if (!Alpine?.effect || !model) return;
        const runner = Alpine.effect(() => {
            const files = model.get();
            if (this.syncingModel || !Array.isArray(files)) return;
            if (files.every((file) => file instanceof File)) {
                queueMicrotask(() => this.driver.api.setFiles(files));
            }
        });
        this.onCleanup(() => Alpine.release?.(runner));
    }

    startLivewireModelEffect() {
        const Alpine = globalThis.Alpine;
        const model = this.el._x_model;
        if (!Alpine?.effect || !model) return;
        const hasValue = (value) => Array.isArray(value)
            ? value.length > 0
            : value !== null && value !== undefined && value !== '';
        this.livewireHadValue = hasValue(model.get());
        const runner = Alpine.effect(() => {
            const present = hasValue(model.get());
            queueMicrotask(() => {
                if (this.livewireHadValue && !present && this.state.records.length) {
                    this.clearFromServer();
                }
                this.livewireHadValue = present;
            });
        });
        this.onCleanup(() => Alpine.release?.(runner));
    }

    clearFromServer() {
        this.suppressRemoteRemoval = true;
        for (const record of this.state.records) this.cancel(record.id, { render: false });
        this.driver.clearFiles();
        queueMicrotask(() => { this.suppressRemoteRemoval = false; });
    }

    mergeScope() {
        const component = this;
        return Object.defineProperties({}, {
            items: { enumerable: true, get: () => component.state.records.map((record) => component.fileFacade(record.id)) },
            acceptedFiles: { enumerable: true, get: () => component.acceptedRecords().map(({ file }) => file) },
            rejected: { enumerable: true, get: () => component.recordsByStatus('rejected') },
            queued: { enumerable: true, get: () => component.recordsByStatus('queued') },
            uploading: { enumerable: true, get: () => component.recordsByStatus('uploading') },
            uploaded: { enumerable: true, get: () => component.recordsByStatus('uploaded') },
            failed: { enumerable: true, get: () => component.recordsByStatus('error') },
            groups: { enumerable: true, get: () => component.publicGroups() },
            count: { enumerable: true, get: () => component.acceptedRecords().length },
            progress: { enumerable: true, get: () => component.aggregateProgress() },
            pending: { enumerable: true, get: () => component.hasPendingUploads() },
            transport: { enumerable: true, get: () => component.transportName() },
            formControl: { enumerable: true, get: () => component.formControl },
            form: { enumerable: true, get: () => component.formControl?.form ?? null },
            validity: { enumerable: true, get: () => component.formControl?.validity ?? null },
            valid: { enumerable: true, get: () => component.formControl?.validity?.valid ?? true },
            invalid: { enumerable: true, get: () => component.state.validationVisible },
            validationMessage: { enumerable: true, get: () => component.formControl?.validationMessage ?? '' },
            open: {
                enumerable: true,
                get: () => component.state.open,
                set: (value) => (value ? component.show() : component.close()),
            },
            presentation: { enumerable: true, get: () => component.state.presentation },
            openPicker: { enumerable: true, value: () => component.openPicker() },
            add: { enumerable: true, value: (files) => component.add(files) },
            file: { enumerable: true, value: (id) => component.fileFacade(id) },
            remove: { enumerable: true, value: (id) => component.remove(id) },
            clear: { enumerable: true, value: () => component.clear() },
            upload: { enumerable: true, value: (id) => component.upload(id) },
            uploadAll: { enumerable: true, value: () => component.uploadAll() },
            retry: { enumerable: true, value: (id) => component.retry(id) },
            cancel: { enumerable: true, value: (id) => component.cancel(id) },
            show: { enumerable: true, value: () => component.show() },
            close: { enumerable: true, value: () => component.close() },
            toggleOverlay: { enumerable: true, value: () => component.toggleOverlay() },
            checkValidity: { enumerable: true, value: () => component.checkValidity() },
            reportValidity: { enumerable: true, value: () => component.reportValidity() },
            setCustomValidity: { enumerable: true, value: (message) => component.setCustomValidity(message) },
            setFileError: { enumerable: true, value: (id, message) => component.setFileError(id, message) },
        });
    }

    recordsByStatus(status) {
        return this.state.records
            .filter((record) => record.status === status)
            .map((record) => this.fileFacade(record.id));
    }

    acceptedRecords() {
        return this.state.records.filter((record) => record.status !== 'rejected');
    }

    record(id) {
        return this.state.records.find((record) => record.id === String(id)) ?? null;
    }

    fileFacade(id) {
        const key = String(id);
        if (this.facades.has(key)) return this.facades.get(key);
        const component = this;
        const facade = Object.defineProperties({}, {
            id: { enumerable: true, get: () => key },
            file: { enumerable: true, get: () => component.record(key)?.file ?? null },
            name: { enumerable: true, get: () => component.record(key)?.name ?? '' },
            size: { enumerable: true, get: () => component.record(key)?.size ?? 0 },
            sizeText: { enumerable: true, get: () => component.record(key)?.sizeText ?? '' },
            type: { enumerable: true, get: () => component.record(key)?.type ?? '' },
            extension: { enumerable: true, get: () => component.record(key)?.extension ?? 'FILE' },
            category: { enumerable: true, get: () => component.record(key)?.category ?? 'file' },
            lastModified: { enumerable: true, get: () => component.record(key)?.lastModified ?? 0 },
            previewUrl: { enumerable: true, get: () => component.record(key)?.previewUrl ?? '' },
            previewable: { enumerable: true, get: () => Boolean(component.record(key)?.previewUrl) },
            status: { enumerable: true, get: () => component.record(key)?.status ?? 'rejected' },
            progress: { enumerable: true, get: () => component.record(key)?.progress ?? 0 },
            errors: { enumerable: true, get: () => component.record(key)?.errors ?? [] },
            token: { enumerable: true, get: () => component.record(key)?.result?.token ?? null },
            result: { enumerable: true, get: () => component.record(key)?.result ?? null },
            jobId: { enumerable: true, get: () => component.record(key)?.jobId ?? null },
            attention: {
                enumerable: true,
                get: () => ['rejected', 'error', 'cancelled'].includes(component.record(key)?.status),
            },
            active: { enumerable: true, get: () => component.record(key)?.status === 'uploading' },
            complete: { enumerable: true, get: () => component.record(key)?.status === 'uploaded' },
            retryable: {
                enumerable: true,
                get: () => ['error', 'cancelled'].includes(component.record(key)?.status),
            },
            remove: { enumerable: true, value: () => component.remove(key) },
            upload: { enumerable: true, value: () => component.upload(key) },
            retry: { enumerable: true, value: () => component.retry(key) },
            cancel: { enumerable: true, value: () => component.cancel(key) },
        });
        this.facades.set(key, facade);
        return facade;
    }

    queueFileReconcile() {
        if (this.reconcileQueued) return;
        this.reconcileQueued = true;
        queueMicrotask(() => {
            this.reconcileQueued = false;
            if (this.el.isConnected) this.reconcileFiles();
        });
    }

    reconcileFiles() {
        this.driver.promoteDuplicateRejections((file, accepted) => (
            this.attrs.boolean('allow-duplicates')
            || !accepted.some((candidate) => fileFingerprint(candidate) === fileFingerprint(file))
        ));
        this.driver.promoteCountRejections(this.maxFiles());
        const api = this.driver.api;
        const previous = [...this.state.records];
        const claimed = new Set();
        const next = [];
        const find = (file, status) => previous.find((record) => (
            !claimed.has(record.id)
            && record.status === status
            && (record.file === file || record.fingerprint === fileFingerprint(file))
        ));

        for (const file of api.acceptedFiles) {
            let record = previous.find((candidate) => (
                !claimed.has(candidate.id)
                && (candidate.file === file || candidate.fingerprint === fileFingerprint(file))
            ));
            if (!record) record = this.createRecord(file, 'queued');
            if (record.status === 'rejected') {
                record.status = 'queued';
                record.errors = [];
            }
            claimed.add(record.id);
            next.push(record);
        }
        for (const rejection of api.rejectedFiles) {
            let record = find(rejection.file, 'rejected');
            if (!record) record = this.createRecord(rejection.file, 'rejected');
            record.errors = normalizeFileErrors(rejection.errors);
            claimed.add(record.id);
            next.push(record);
        }
        for (const record of previous) {
            if (!claimed.has(record.id)) this.disposeRecord(record, {
                removeRemote: !this.suppressRemoteRemoval,
            });
        }
        this.state.records = next;
        this.syncAlpineModel();
        this.syncValidity();
        this.requestRender();
        this.dispatch('fileschange');
        if (this.isAsync() && this.automaticUpload()) {
            queueMicrotask(() => this.uploadAll());
        }
    }

    createRecord(file, status) {
        const id = `file-${++nextRecordId}`;
        let previewUrl = '';
        if (file.type?.startsWith('image/') && globalThis.URL?.createObjectURL) {
            try {
                previewUrl = globalThis.URL.createObjectURL(file);
                this.previewCleanups.set(id, () => globalThis.URL.revokeObjectURL(previewUrl));
            } catch { /* Preview remains optional. */ }
        }
        return {
            id,
            file,
            fingerprint: fileFingerprint(file),
            name: file.name,
            size: file.size,
            sizeText: formatFileSize(file.size, this.locale()),
            type: file.type || 'application/octet-stream',
            extension: fileExtension(file),
            category: fileCategory(file),
            lastModified: file.lastModified || 0,
            previewUrl,
            status,
            progress: 0,
            errors: [],
            jobId: null,
            result: null,
            attempt: 0,
        };
    }

    disposeRecord(record, { removeRemote = false } = {}) {
        this.cancel(record.id, { render: false });
        this.previewCleanups.get(record.id)?.();
        this.previewCleanups.delete(record.id);
        this.facades.delete(record.id);
        if (removeRemote && record.result) {
            Promise.resolve(this.ensureTransport()?.remove?.(
                record.result,
                { record: this.fileFacade(record.id) },
            )).catch(() => {});
        }
    }

    syncAlpineModel() {
        if (wireModelBinding(this.el) || !this.el._x_model) return;
        this.syncingModel = true;
        try {
            this.el._x_model.set(this.acceptedRecords().map(({ file }) => file));
        } finally {
            queueMicrotask(() => { this.syncingModel = false; });
        }
    }

    ensureTransport() {
        const name = this.transportName();
        if (name === 'form') return null;
        const key = `${name}:${this.attrs.get('upload-url') ?? ''}:${wireModelBinding(this.el) ?? ''}`;
        if (this.transport && this.transportKey === key) return this.transport;
        this.transport = uploadTransports.create(name, { component: this });
        this.transportKey = key;
        return this.transport;
    }

    concurrency() {
        const transport = this.ensureTransport();
        if (Number.isInteger(transport?.concurrency)) return transport.concurrency;
        return integerAttribute(this.attrs, 'concurrency', 3, 1, 20);
    }

    upload(id) {
        if (!this.isAsync() || this.isDisabled() || this.isReadOnly()) return false;
        const record = this.record(id);
        if (!record || !['queued', 'error', 'cancelled'].includes(record.status)) return false;
        record.status = 'queued';
        record.progress = 0;
        record.errors = [];
        record.attempt += 1;
        this.syncValidity();
        this.requestRender();
        this.pumpUploads();
        return true;
    }

    uploadAll() {
        let changed = false;
        for (const record of this.state.records) {
            if (record.status === 'queued') changed = this.upload(record.id) || changed;
        }
        this.pumpUploads();
        return changed;
    }

    pumpUploads() {
        if (!this.isAsync()) return;
        while (this.activeUploads < this.concurrency()) {
            const record = this.state.records.find((candidate) => (
                candidate.status === 'queued' && !this.tasks.has(candidate.id)
            ));
            if (!record) break;
            this.startUpload(record);
        }
    }

    startUpload(record) {
        let task;
        const attempt = record.attempt;
        try {
            task = this.ensureTransport().start(this.fileFacade(record.id), {
                progress: (percent) => {
                    if (record.attempt !== attempt || record.status !== 'uploading') return;
                    record.progress = Math.max(0, Math.min(100, Number(percent) || 0));
                    this.requestRender();
                    this.dispatch('uploadprogress', record);
                },
            });
            if (!task?.result || typeof task.result.then !== 'function') {
                throw new Error('Upload transport start() must return a task with a result Promise.');
            }
        } catch (error) {
            record.status = 'error';
            record.errors = normalizeFileErrors(error?.message ?? error);
            this.requestRender();
            return;
        }
        record.status = 'uploading';
        record.jobId = task.jobId ?? null;
        this.tasks.set(record.id, { ...task, attempt });
        this.activeUploads += 1;
        this.dispatch('uploadstart', record);
        this.syncValidity();
        this.requestRender();
        task.result.then((result) => {
            if (this.tasks.get(record.id)?.attempt !== attempt) return;
            record.result = result;
            record.jobId = result?.jobId ?? record.jobId;
            record.progress = 100;
            record.status = 'uploaded';
            record.errors = [];
            this.dispatch('uploadsuccess', record);
        }).catch((error) => {
            if (this.tasks.get(record.id)?.attempt !== attempt) return;
            if (error?.name === 'AbortError') {
                record.status = 'cancelled';
                this.dispatch('uploadcancel', record);
            } else {
                record.status = 'error';
                record.errors = normalizeFileErrors(error?.message ?? 'The file failed to upload.');
                this.dispatch('uploaderror', record);
            }
        }).finally(() => {
            if (this.tasks.get(record.id)?.attempt !== attempt) return;
            this.tasks.delete(record.id);
            this.activeUploads = Math.max(0, this.activeUploads - 1);
            this.syncValidity();
            this.requestRender();
            this.pumpUploads();
        });
    }

    retry(id) {
        return this.upload(id);
    }

    cancel(id, { render = true } = {}) {
        const record = this.record(id);
        const task = this.tasks.get(String(id));
        if (!record || (!task && record.status !== 'queued')) return false;
        record.attempt += 1;
        task?.cancel?.();
        if (task) {
            this.tasks.delete(String(id));
            this.activeUploads = Math.max(0, this.activeUploads - 1);
        }
        record.status = 'cancelled';
        record.progress = 0;
        this.dispatch('uploadcancel', record);
        this.syncValidity();
        if (render) this.requestRender();
        queueMicrotask(() => this.pumpUploads());
        return true;
    }

    remove(id) {
        if (this.isDisabled() || this.isReadOnly()) return false;
        const record = this.record(id);
        if (!record) return false;
        const type = record.status === 'rejected' ? 'rejected' : 'accepted';
        this.driver.deleteFile(record.file, type);
        this.dispatch('fileremove', record);
        return true;
    }

    clear() {
        if (this.isDisabled() || this.isReadOnly()) return false;
        if (this.state.records.length === 0) return false;
        this.driver.clearFiles();
        return true;
    }

    add(files) {
        if (this.isDisabled() || this.isReadOnly()) return false;
        const values = Array.from(files ?? []).filter((file) => file instanceof File);
        if (values.length === 0) return false;
        this.driver.addFiles(values);
        return true;
    }

    openPicker() {
        if (this.isDisabled() || this.isReadOnly()) return false;
        this.driver.api.openFilePicker();
        return true;
    }

    hasPendingUploads() {
        return this.isAsync() && this.acceptedRecords().some((record) => (
            record.status !== 'uploaded'
        ));
    }

    aggregateProgress() {
        const records = this.acceptedRecords();
        const total = records.reduce((sum, record) => sum + Math.max(1, record.size), 0);
        if (!total) return 0;
        return Math.round(records.reduce((sum, record) => (
            sum + (Math.max(1, record.size) * record.progress)
        ), 0) / total);
    }

    setFileError(id, message) {
        const record = this.record(id);
        if (!record) return false;
        record.errors = normalizeFileErrors(message);
        if (record.errors.length) record.status = 'error';
        this.syncValidity();
        this.requestRender();
        return true;
    }

    dispatch(type, record = null) {
        const detail = record
            ? { item: this.fileFacade(record.id) }
            : { items: this.state.records.map(({ id }) => this.fileFacade(id)) };
        this.el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
    }

    resolveFileTemplate() {
        const nodes = this.slots.get('file').all();
        if (nodes.length === 0) return null;
        if (nodes.length !== 1 || nodes[0].localName !== 'template') {
            throw new Error("Component 'file-upload' file slot must use one <template slot='file'>.");
        }
        const roots = visibleNodes(nodes[0]);
        if (roots.length !== 1) {
            throw new Error("Component 'file-upload' file template requires exactly one root element.");
        }
        return roots[0];
    }

    prepareRender() {
        prepareAccessories(this.attrs, this.slots);
        this.fileTemplate = this.resolveFileTemplate();
        return { count: this.acceptedRecords().length };
    }

    hostAttributes() {
        return {
            'data-isas-file-upload': '',
            'data-mode': this.modeValue(),
            'data-transport': this.transportName(),
            'data-disabled': this.isDisabled() || undefined,
            'data-readonly': this.isReadOnly() || undefined,
            'data-invalid': this.state.validationVisible || undefined,
            'data-uploading': this.state.records.some(({ status }) => status === 'uploading') || undefined,
        };
    }

    render() {
        const html = this.renderer.render();
        queueMicrotask(() => queueMicrotask(() => {
            if (this.el.isConnected) this.driver.bindRendered();
        }));
        return html;
    }

    handleClick(event) {
        const close = event.target.closest?.([
            '[data-isas-file-upload-close]',
            '[data-isas-file-upload-done]',
        ].join(','));
        if (close) {
            event.preventDefault();
            this.close();
            return;
        }
        const action = event.target.closest?.('[data-file-action]');
        if (action) {
            event.preventDefault();
            const id = action.dataset.fileId;
            const method = action.dataset.fileAction;
            if (typeof this[method] === 'function') this[method](id);
            return;
        }
        const shell = event.target.closest?.('[data-isas-file-upload-trigger-shell]');
        if (!shell
            || event.target.closest?.('[data-isas-file-upload-trigger]')
            || event.target.closest?.('[data-isas-file-upload-picker]')) return;
        const interactive = event.target.closest?.([
            'a', 'button', 'input', 'select', 'textarea', 'summary',
            '[contenteditable="true"]', '[role="button"]', '[role="link"]',
            '[tabindex]:not([tabindex="-1"])',
        ].join(','));
        if (interactive && interactive !== shell) return;
        event.preventDefault();
        this.show();
    }

    bindFormControl() {
        const control = this.el.querySelector('[data-isas-file-upload-native]');
        if (control === this.formControl) {
            this.syncValidity();
            return;
        }
        this.formBinding?.cleanup();
        this.formControl = control;
        if (!control) return;
        const invalid = (event) => {
            event.preventDefault();
            this.refreshValidation({ show: true, focus: true });
        };
        control.addEventListener('invalid', invalid);
        const form = control.form;
        const reset = () => queueMicrotask(() => {
            for (const record of [...this.state.records]) this.disposeRecord(record);
            this.state.records = [];
            this.customValidityMessage = '';
            this.driver.api.clearFiles();
            this.refreshValidation({ reset: true });
        });
        form?.addEventListener('reset', reset);
        this.formBinding = {
            cleanup: () => {
                control.removeEventListener('invalid', invalid);
                form?.removeEventListener('reset', reset);
            },
        };
        this.syncValidity();
    }

    syncValidity() {
        const control = this.formControl;
        if (!control) return;
        if (this.ownedValidityMessage && control.validationMessage === this.ownedValidityMessage) {
            control.setCustomValidity('');
        }
        let message = this.customValidityMessage;
        const authored = this.attrs.get('error');
        if (!message && authored && !['true', '1'].includes(String(authored).toLowerCase())) {
            message = String(authored);
        }
        if (!message) {
            const rejected = this.state.records.find((record) => record.status === 'rejected' && record.errors.length);
            if (rejected) message = rejected.errors[0];
        }
        if (!message && this.isAsync()) {
            if (this.state.records.some((record) => record.status === 'error')) {
                message = 'One or more files failed to upload.';
            } else if (this.hasPendingUploads()) {
                message = 'Wait for files to finish uploading before submitting.';
            }
        }
        if (message) control.setCustomValidity(message);
        this.ownedValidityMessage = message;
        this.refreshValidation({ show: Boolean(authored) || this.state.validationVisible });
    }

    refreshValidation({ show = false, reset = false, focus = false } = {}) {
        const valid = this.formControl?.validity?.valid ?? true;
        if (reset || valid) this.state.validationVisible = false;
        if (show && !valid) this.state.validationVisible = true;
        this.state.validationMessage = this.state.validationVisible
            ? (this.formControl?.validationMessage ?? '')
            : '';
        if (focus && !valid) this.focusValidationTarget();
        return valid;
    }

    focusValidationTarget() {
        const selector = this.modeValue() === 'inline'
            ? '[data-isas-file-upload-dropzone]'
            : '[data-isas-file-upload-trigger]';
        this.el.querySelector(selector)?.focus();
    }

    checkValidity() {
        this.syncValidity();
        return this.formControl?.checkValidity() ?? true;
    }

    reportValidity() {
        this.syncValidity();
        const valid = this.formControl?.reportValidity() ?? true;
        if (!valid) this.refreshValidation({ show: true, focus: true });
        return valid;
    }

    setCustomValidity(message = '') {
        this.customValidityMessage = String(message ?? '');
        this.syncValidity();
        this.requestRender();
        return true;
    }

    afterDriverBind() {
        this.bindFormControl();
        this.bindOverlay();
        this.refreshOverlayPositioning();
    }

    refreshOverlayPositioning() {
        const controller = this.overlayComponent()?.controller;
        if (!controller?.state.open || controller.state.presentation !== 'dropdown') return;
        queueMicrotask(() => {
            if (this.el.isConnected) controller.refreshPositioning();
        });
    }

    bindOverlay() {
        const overlay = this.el.querySelector(`#${CSS.escape(this.overlayId)}`);
        if (this.overlayBinding?.element === overlay) return;
        this.overlayBinding?.cleanup();
        this.overlayBinding = null;
        if (!overlay) {
            this.state.open = false;
            return;
        }
        const sync = () => {
            const component = this.overlayComponent();
            this.state.open = Boolean(component?.controller?.state.open);
            this.state.presentation = component?.presentation ?? 'dropdown';
            if (this.state.open && this.state.presentation === 'dropdown') {
                queueMicrotask(() => component.controller.startPositioning());
            }
            for (const header of this.el.querySelectorAll('[data-isas-file-upload-dialog-only]')) {
                header.hidden = this.state.presentation !== 'dialog';
            }
        };
        for (const name of ['toggle', 'close', 'presentationchange']) overlay.addEventListener(name, sync);
        this.overlayBinding = {
            element: overlay,
            cleanup: () => {
                for (const name of ['toggle', 'close', 'presentationchange']) overlay.removeEventListener(name, sync);
            },
        };
        sync();
    }

    overlayComponent() {
        const overlay = this.el.querySelector(`#${CSS.escape(this.overlayId)}`);
        return overlay ? this.runtime.constructor.from(overlay)?.componentFor('overlay') : null;
    }

    show() {
        if (this.modeValue() === 'inline') return false;
        return this.overlayComponent()?.show({ source: this.el.querySelector('[data-isas-file-upload-trigger]') }) ?? false;
    }

    close() {
        return this.overlayComponent()?.close() ?? false;
    }

    toggleOverlay() {
        if (this.modeValue() === 'inline') return false;
        return this.overlayComponent()?.toggle({ source: this.el.querySelector('[data-isas-file-upload-trigger]') }) ?? false;
    }

    attributeChanged(name) {
        if ([
            'accept', 'capture', 'directory', 'disabled', 'readonly', 'required',
            'multiple', 'max-files', 'min-file-size', 'max-file-size',
            'allow-drop', 'prevent-document-drop', 'locale', 'error',
        ].includes(name)) this.driver.update();
        if (['transport', 'upload-url'].includes(name)) {
            this.transport = null;
            this.transportKey = '';
        }
        this.syncValidity();
    }

    sourceChanged() {
        this.driver.update();
        this.syncValidity();
    }

    destroy() {
        this.overlayBinding?.cleanup();
        this.formBinding?.cleanup();
        for (const record of [...this.state.records]) this.disposeRecord(record);
        this.driver?.destroy();
        this.tasks.clear();
        this.facades.clear();
        this.formControl = null;
    }
}
