import { AttributeBag } from '../../support/attribute-bag.js';
import { generatedComponentAttributes } from '../../support/generated-component.js';
import { escapeHtml, renderElement as element } from '../../support/html.js';

const ICON_PARTS = new Set([
    'image', 'pdf', 'audio', 'video', 'text', 'archive', 'document',
    'spreadsheet', 'code', 'file',
]);

function setElementAttributes(node, attributes) {
    for (const [name, value] of attributes.entries()) {
        if (value === false || value === null || value === undefined) node.removeAttribute(name);
        else node.setAttribute(name, value === true ? '' : String(value));
    }
}

export class FileUploadView {
    constructor(component) {
        this.component = component;
    }

    get attrs() {
        return this.component.attrs;
    }

    get slots() {
        return this.component.slots;
    }

    renderNativeControl() {
        const component = this.component;
        const attributes = this.attrs.for('native').merge({
            id: `${component.uploadId}-native`,
            type: 'file',
            name: component.transportName() === 'form' ? this.attrs.get('name') ?? undefined : undefined,
            form: this.attrs.get('form') ?? undefined,
            accept: this.attrs.get('accept') ?? undefined,
            capture: this.attrs.get('capture') ?? undefined,
            multiple: this.attrs.boolean('multiple'),
            required: this.attrs.boolean('required'),
            disabled: component.isDisabled(),
            'data-isas-file-upload-native': '',
            'data-isas-key': `${component.uploadId}:native`,
            ...generatedComponentAttributes('file-upload:native', { content: 'morph' }),
        }).remove('hidden');
        return element('input', attributes, null);
    }

    renderTokenControls() {
        const component = this.component;
        if (!component.isAsync()) return '';
        const name = this.attrs.get('token-name') ?? this.attrs.get('name');
        if (!name) return '';
        return component.state.records
            .filter((record) => record.status === 'uploaded' && record.result?.token)
            .map((record) => element('input', new AttributeBag({
                type: 'hidden',
                name,
                value: record.result.token,
                form: this.attrs.get('form') ?? undefined,
                disabled: component.isDisabled(),
                'data-isas-file-upload-token': record.id,
                'data-isas-key': `file-upload-token:${record.id}`,
            }), null)).join('');
    }

    renderDropzoneDefault() {
        const component = this.component;
        const authored = this.attrs.get('dropzone-text');
        const dialog = component.state.presentation === 'dialog' && component.modeValue() !== 'inline';
        let title;
        if (authored) {
            title = escapeHtml(authored);
        } else if (dialog || !component.allowDrop()) {
            title = escapeHtml('Choose files');
        } else {
            title = `Drop files here or ${element('span', this.attrs.for('dropzone-action'), 'browse')}`;
        }
        return [
            element('span', this.attrs.for('dropzone-icon').merge({ 'aria-hidden': 'true' }), ''),
            element('strong', this.attrs.for('dropzone-title'), title),
            element('span', this.attrs.for('dropzone-support'), escapeHtml(component.supportText())),
        ].join('');
    }

    renderDropzone() {
        const component = this.component;
        const content = this.slots.get('dropzone').filled()
            ? this.slots.get('dropzone').html()
            : this.renderDropzoneDefault();
        return element('div', this.attrs.for('dropzone').merge({
            id: `${component.uploadId}-dropzone`,
            'data-isas-file-upload-dropzone': '',
            'data-presentation': component.state.presentation,
            'aria-describedby': component.state.validationVisible
                ? `${component.uploadId}-error`
                : undefined,
        }), content);
    }

    renderPreview(record) {
        if (record.previewUrl) {
            return element('img', this.attrs.for('preview-image').merge({
                src: record.previewUrl,
                alt: `Preview of ${record.name}`,
            }), null);
        }
        const iconPart = ICON_PARTS.has(record.category) ? record.category : 'file';
        return [
            element('span', this.attrs.for('preview-icon').merge(
                this.attrs.for(`preview-icon-${iconPart}`),
            ).merge({ 'aria-hidden': 'true' })),
            element('span', this.attrs.for('extension'), escapeHtml(record.extension)),
        ].join('');
    }

    status(record) {
        const component = this.component;
        if (record.status === 'rejected') return { key: 'attention', label: 'Not accepted' };
        if (record.status === 'error') return { key: 'attention', label: 'Upload failed' };
        if (record.status === 'cancelled') return { key: 'cancelled', label: 'Upload cancelled' };
        if (record.status === 'uploading') {
            return { key: 'uploading', label: `Uploading ${Math.round(record.progress)}%` };
        }
        if (record.status === 'uploaded') return { key: 'complete', label: 'Uploaded' };
        if (!component.isAsync()) return { key: 'complete', label: 'Selected' };
        if (!component.automaticUpload()) return { key: 'queued', label: 'Ready to upload' };
        return { key: 'queued', label: 'Queued' };
    }

    renderStatus(record) {
        const status = this.status(record);
        return element('span', this.attrs.for('status').merge({
            'data-file-status': status.key,
            'aria-label': status.label,
            title: status.label,
        }), [
            element('span', this.attrs.for('status-icon').merge(
                this.attrs.for(`status-icon-${status.key}`),
            ).merge({ 'aria-hidden': 'true' })),
            element('span', this.attrs.for('status-text'), escapeHtml(status.label)),
        ].join(''));
    }

    renderProgress(record) {
        if (!this.component.isAsync() || record.status !== 'uploading') return '';
        return element('div', this.attrs.for('progress-wrapper'), [
            element('progress', this.attrs.for('progress').merge({
                max: 100,
                value: record.progress,
                'aria-label': `Upload progress for ${record.name}`,
            })),
            element('span', this.attrs.for('progress-value'), `${Math.round(record.progress)}%`),
        ].join(''));
    }

    renderActions(record) {
        const component = this.component;
        const actions = [
            ['upload', record.status === 'queued' && component.isAsync() && !component.automaticUpload(), 'Upload'],
            ['retry', ['error', 'cancelled'].includes(record.status) && component.isAsync(), 'Retry'],
            ['cancel', record.status === 'uploading', 'Cancel'],
            ['remove', record.status !== 'uploading', 'Remove'],
        ];
        return actions.filter(([, visible]) => visible).map(([action,, label]) => element(
            'button',
            this.attrs.for(`${action}-action`).merge({
                type: 'button',
                disabled: component.isDisabled() || component.isReadOnly(),
                'data-file-action': action,
                'data-file-id': record.id,
                'aria-label': `${label} ${record.name}`,
            }),
            element('span', this.attrs.for(`${action}-icon`).merge({ 'aria-hidden': 'true' })),
        )).join('');
    }

    renderFile(record) {
        const component = this.component;
        if (component.fileTemplate) {
            const root = component.fileTemplate.cloneNode(true);
            const authored = AttributeBag.fromElement(root);
            setElementAttributes(root, authored.merge(this.attrs.for('file')).merge({
                role: root.getAttribute('role') ?? 'listitem',
                'data-isas-file-upload-file': record.id,
                'data-status': record.status,
                'data-category': record.category,
                'data-isas-key': `file-upload-file:${record.id}`,
                'x-data': `{ get $file() { return $fileUpload.file(${JSON.stringify(record.id)}) } }`,
            }));
            return root.outerHTML;
        }

        const errors = element('div', this.attrs.for('file-error').merge({
            hidden: record.errors.length === 0,
            'aria-live': 'polite',
        }), escapeHtml(record.errors.join(' ')));
        return element('li', this.attrs.for('file').merge({
            'data-isas-file-upload-file': record.id,
            'data-status': record.status,
            'data-category': record.category,
            'data-isas-key': `file-upload-file:${record.id}`,
        }), [
            element('div', this.attrs.for('preview'), this.renderPreview(record)),
            element('div', this.attrs.for('metadata'), [
                element('strong', this.attrs.for('name').merge({ title: record.name }), escapeHtml(record.name)),
                element('span', this.attrs.for('details'), escapeHtml(`${record.sizeText} · ${record.extension}`)),
                this.renderProgress(record),
                errors,
            ].join('')),
            element('div', this.attrs.for('actions'), `${this.renderStatus(record)}${this.renderActions(record)}`),
        ].join(''));
    }

    renderList(records, key = 'all') {
        return element('ul', this.attrs.for('list').merge({
            role: 'list',
            'data-isas-file-upload-list': key,
        }), records.map((record) => this.renderFile(record)).join(''));
    }

    slotLabel(name, fallback) {
        return this.slots.get(name).filled()
            ? this.slots.get(name).html()
            : escapeHtml(fallback);
    }

    renderSection(group) {
        const label = group.key === 'attention'
            ? this.slotLabel('attention-label', 'Needs attention')
            : this.slotLabel('files-label', 'Files');
        return element('section', this.attrs.for('section').merge(
            this.attrs.for(`${group.key}-section`),
        ).merge({
            'data-file-group': group.key,
        }), [
            element('div', this.attrs.for('section-heading'), [
                element('h3', this.attrs.for('section-title'), label),
                element('span', this.attrs.for('section-count'), escapeHtml(String(group.records.length))),
            ].join('')),
            this.renderList(group.records, group.key),
        ].join(''));
    }

    renderLists() {
        const component = this.component;
        if (component.state.records.length === 0) {
            if (!this.slots.get('empty').filled()) return '';
            return element('div', this.attrs.for('empty'), this.slots.get('empty').html());
        }
        if (component.groupingValue() === 'none') {
            return this.renderList(component.state.records);
        }
        return element('div', this.attrs.for('groups').merge({
            'data-isas-file-upload-groups': '',
        }), component.recordGroups()
            .filter((group) => group.records.length)
            .map((group) => this.renderSection(group)).join(''));
    }

    renderBody() {
        return element('div', this.attrs.for('body').merge(this.attrs.for('content')).merge({
            'data-isas-file-upload-body': '',
            'data-isas-file-upload-content': '',
            'data-surface': this.component.modeValue() === 'inline' ? 'inline' : 'overlay',
            'data-presentation': this.component.state.presentation,
        }), `${this.renderDropzone()}${this.renderLists()}`);
    }

    renderTriggerValue() {
        const component = this.component;
        if (this.slots.get('value').filled()) {
            return element('span', this.attrs.for('value').merge({
                'data-isas-file-upload-value': '',
                'data-isas-slot-owns-children': '',
            }), this.slots.get('value').html());
        }
        const count = component.acceptedRecords().length;
        const label = count === 0
            ? String(this.attrs.get('placeholder') ?? 'Add files')
            : `${count} ${count === 1 ? 'file' : 'files'} added`;
        return element('span', this.attrs.for(count ? 'value' : 'placeholder').merge({
            'data-isas-file-upload-value': '',
        }), escapeHtml(label));
    }

    renderPrepend() {
        const content = this.slots.get('prepend').filled()
            ? this.slots.get('prepend').html()
            : element('span', this.attrs.for('trigger-icon').merge({ 'aria-hidden': 'true' }));
        return element('span', this.attrs.for('prepend').merge({
            'data-isas-file-upload-prepend': '',
        }), content);
    }

    renderQuickAdd() {
        if (!this.component.quickAdd()) return '';
        const content = this.slots.get('append').filled()
            ? this.slots.get('append').html()
            : element('span', this.attrs.for('add-icon').merge({ 'aria-hidden': 'true' }));
        return element('button', this.attrs.for('add-action').merge({
            type: 'button',
            disabled: this.component.isDisabled() || this.component.isReadOnly(),
            'aria-label': 'Add files directly',
            'data-isas-file-upload-picker': '',
        }), content);
    }

    renderTriggerShell() {
        const component = this.component;
        return element('div', this.attrs.for('trigger-shell').merge({
            'data-isas-key': `${component.uploadId}:trigger-shell`,
            'data-isas-file-upload-trigger-shell': '',
            'data-readonly': component.isReadOnly() || undefined,
        }), [
            this.renderPrepend(),
            element('button', this.attrs.for('trigger').merge({
                type: 'button',
                disabled: component.isDisabled(),
                'aria-expanded': component.state.open ? 'true' : 'false',
                'aria-haspopup': component.state.presentation === 'dialog' ? 'dialog' : 'true',
                'aria-controls': component.overlayId,
                'aria-invalid': component.state.validationVisible ? 'true' : undefined,
                'aria-required': this.attrs.boolean('required') ? 'true' : undefined,
                'x-as': 'overlay-trigger',
                'controls-overlay': component.overlayId,
                'data-isas-file-upload-trigger': '',
                ...generatedComponentAttributes('file-upload:trigger', { content: 'morph' }),
            }), [
                this.renderTriggerValue(),
                element('span', this.attrs.for('trigger-indicator').merge({
                    'aria-hidden': 'true',
                    'data-open': component.state.open || undefined,
                })),
            ].join('')),
            this.renderQuickAdd(),
        ].join(''));
    }

    renderTitle() {
        return this.slots.get('dialog-title').filled()
            ? this.slots.get('dialog-title').html()
            : escapeHtml(this.attrs.get('label') ?? 'Add files');
    }

    renderDescription() {
        const content = this.slots.get('description').filled()
            ? this.slots.get('description').html()
            : escapeHtml(this.attrs.get('description') ?? '');
        if (!content) return '';
        return element('p', this.attrs.for('description').merge({
            id: `${this.component.overlayId}-description`,
        }), content);
    }

    renderHeader() {
        const component = this.component;
        const count = component.acceptedRecords().length;
        const countText = element('span', this.attrs.for('count').merge({
            'data-presentation': component.state.presentation,
        }), `${count} added`);
        const dialog = component.state.presentation === 'dialog';
        const actions = this.slots.get('header-actions').filled()
            ? this.slots.get('header-actions').html()
            : (dialog ? '' : countText);
        return element('header', this.attrs.for('header').merge(this.attrs.for('dialog-header')).merge({
            'data-isas-file-upload-header': '',
            'data-presentation': component.state.presentation,
        }), [
            element('div', this.attrs.for('header-copy'), [
                element('h2', this.attrs.for('title').merge(this.attrs.for('dialog-title')).merge({
                    id: component.titleId,
                }), this.renderTitle()),
                dialog ? countText : '',
                this.renderDescription(),
            ].join('')),
            element('div', this.attrs.for('header-actions'), [
                actions,
                element('button', this.attrs.for('dialog-close').merge({
                    type: 'button',
                    'data-isas-file-upload-close': '',
                    'aria-label': 'Close file upload',
                }), element('span', this.attrs.for('dialog-close-icon').merge({ 'aria-hidden': 'true' }))),
            ].join('')),
        ].join(''));
    }

    renderFooter() {
        const component = this.component;
        const authored = this.slots.get('footer').filled();
        if (!authored && component.state.presentation !== 'dialog') return '';
        const content = authored
            ? this.slots.get('footer').html()
            : element('button', this.attrs.for('done-action').merge({
                type: 'button',
                'data-isas-file-upload-done': '',
            }), 'Done');
        return element('footer', this.attrs.for('footer').merge({
            'data-isas-file-upload-footer': '',
            'data-presentation': component.state.presentation,
        }), content);
    }

    renderOverlay() {
        const component = this.component;
        const description = this.slots.get('description').filled() || this.attrs.get('description')
            ? `${component.overlayId}-description`
            : undefined;
        return element('dialog', this.attrs.for('overlay').merge({
            id: component.overlayId,
            'x-is': 'overlay',
            popover: 'auto',
            mode: component.modeValue(),
            breakpoint: this.attrs.get('breakpoint') ?? undefined,
            closedby: this.attrs.get('closedby', 'any'),
            'aria-labelledby': component.titleId,
            'aria-describedby': description,
            ...generatedComponentAttributes('file-upload:overlay'),
        }), element('div', this.attrs.for('panel').merge({
            'x-part': 'content',
            'data-presentation': component.state.presentation,
        }), [
            this.renderHeader(),
            this.renderBody(),
            this.renderFooter(),
        ].join('')));
    }

    renderError() {
        const component = this.component;
        const attributes = this.attrs.for('error').merge({
            id: `${component.uploadId}-error`,
            hidden: !component.state.validationVisible,
            'aria-live': 'polite',
            'data-isas-file-upload-error': '',
        });
        if (this.slots.get('error').filled()) return this.slots.get('error').attrs(attributes).html();
        return element('p', attributes, escapeHtml(component.state.validationMessage));
    }

    render() {
        const component = this.component;
        const body = component.modeValue() === 'inline'
            ? this.renderBody()
            : `${this.renderTriggerShell()}${this.renderOverlay()}`;
        return `${this.renderNativeControl()}${body}${this.renderError()}${this.renderTokenControls()}`;
    }
}
