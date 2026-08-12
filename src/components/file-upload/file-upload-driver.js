import * as fileUpload from '@zag-js/file-upload';
import { normalizeProps, spreadProps, VanillaMachine } from '@zag-js/vanilla';

/** Private Zag boundary. Upload transports and public records stay outside Zag. */
export class FileUploadDriver {
    constructor(component, id) {
        this.component = component;
        this.id = id;
        this.bindings = new Map();
        this.service = new VanillaMachine(fileUpload.machine, () => component.machineProps(id));
        this.unsubscribe = this.service.subscribe(() => component.requestRender());
        this.service.start();
    }

    get api() {
        return fileUpload.connect(this.service.service, normalizeProps);
    }

    update() {
        this.service.updateProps(() => this.component.machineProps(this.id));
    }

    addFiles(files) {
        this.service.service.send({ type: 'FILE.SELECT', files: Array.from(files ?? []) });
    }

    deleteFile(file, type = 'accepted') {
        this.api.deleteFile(file, type);
    }

    clearFiles() {
        this.api.clearFiles();
    }

    promoteDuplicateRejections(shouldPromote) {
        const context = this.service.service.context;
        const accepted = context.get('acceptedFiles');
        const rejected = context.get('rejectedFiles');
        const promoted = rejected.filter((rejection) => (
            rejection.errors.length === 1
            && rejection.errors[0] === 'FILE_EXISTS'
            && shouldPromote(rejection.file, accepted)
        ));
        if (promoted.length === 0) return false;
        const files = new Set(promoted.map(({ file }) => file));
        context.set('acceptedFiles', [...accepted, ...promoted.map(({ file }) => file)]);
        context.set('rejectedFiles', rejected.filter(({ file }) => !files.has(file)));
        return true;
    }

    promoteCountRejections(maxFiles) {
        const context = this.service.service.context;
        const accepted = context.get('acceptedFiles');
        const rejected = context.get('rejectedFiles');
        const candidates = rejected.filter(({ errors }) => (
            errors.length === 1 && errors[0] === 'TOO_MANY_FILES'
        ));
        if (candidates.length === 0 || accepted.length + candidates.length > maxFiles) {
            return false;
        }

        const files = new Set(candidates.map(({ file }) => file));
        context.set('acceptedFiles', [...accepted, ...candidates.map(({ file }) => file)]);
        context.set('rejectedFiles', rejected.filter(({ file }) => !files.has(file)));
        return true;
    }

    bind(element, props) {
        if (!element || !props) return;
        const previous = this.previousBindings?.get(element);
        previous?.cleanup();
        this.bindings.set(element, {
            cleanup: spreadProps(element, props, this.id),
            props,
        });
    }

    bindRendered() {
        const previousBindings = this.bindings;
        this.bindings = new Map();
        this.previousBindings = previousBindings;
        const host = this.component.el;
        if (!host.isConnected) return;
        const api = this.api;
        this.component.runtime.mutateHost(() => this.bind(host, api.getRootProps()));
        this.bind(host.querySelector('[data-isas-file-upload-native]'), api.getHiddenInputProps());
        this.bind(host.querySelector('[data-isas-file-upload-dropzone]'), api.getDropzoneProps());
        for (const trigger of host.querySelectorAll('[data-isas-file-upload-picker]')) {
            this.bind(trigger, api.getTriggerProps());
        }
        for (const [element, binding] of previousBindings) {
            if (!this.bindings.has(element)) binding.cleanup();
        }
        this.previousBindings = null;
        this.component.afterDriverBind?.();
    }

    destroy() {
        for (const binding of [...this.bindings.values()].reverse()) binding.cleanup();
        this.bindings.clear();
        this.unsubscribe?.();
        this.service.stop();
    }
}
