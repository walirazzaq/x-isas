import { resolveInputStyleClasses } from './input-styles.js';

const iconParts = {
    'preview-icon-image': 'i-tabler-photo',
    'preview-icon-pdf': 'i-tabler-file-type-pdf',
    'preview-icon-audio': 'i-tabler-file-music',
    'preview-icon-video': 'i-tabler-file-video',
    'preview-icon-text': 'i-tabler-file-text',
    'preview-icon-archive': 'i-tabler-file-zip',
    'preview-icon-document': 'i-tabler-file-description',
    'preview-icon-spreadsheet': 'i-tabler-file-spreadsheet',
    'preview-icon-code': 'i-tabler-file-code',
    'preview-icon-file': 'i-tabler-file',
};

export function fileUploadAdapter({ attrs, component }) {
    const invalid = Boolean(component?.state?.validationVisible);
    const { color, size, variant } = resolveInputStyleClasses(attrs, { invalid });
    const icons = Object.fromEntries(Object.entries(iconParts).map(([name, icon]) => [
        name,
        { class: `${icon} size-6 opacity-60` },
    ]));
    return {
        host: { class: 'block max-w-full align-top' },
        parts: {
            native: { class: 'sr-only' },
            body: {
                class: [
                    'flex min-h-0 min-w-0 flex-col gap-5',
                    'data-[surface=overlay]:overflow-y-auto data-[surface=overlay]:overscroll-contain',
                    'data-[surface=overlay]:px-4 data-[surface=overlay]:py-4',
                ],
            },
            dropzone: {
                class: [
                    'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-box',
                    'border border-dashed border-base-300 bg-base-200/25 px-4 py-5 text-center outline-none',
                    'transition-colors hover:border-primary/60 hover:bg-primary/5',
                    'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
                    'data-[dragging]:border-primary data-[dragging]:bg-primary/10',
                    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                    'data-[invalid]:border-error/60 data-[invalid]:bg-error/5',
                    'data-[presentation=dialog]:min-h-32',
                ],
            },
            'dropzone-icon': { class: 'i-tabler-cloud-upload mb-1 size-7 text-primary' },
            'dropzone-title': { class: 'text-sm font-medium sm:text-base' },
            'dropzone-action': { class: 'text-primary underline-offset-2' },
            'dropzone-support': { class: 'text-xs text-base-content/55 sm:text-sm' },
            groups: { class: 'flex min-w-0 flex-col gap-5' },
            section: { class: 'flex min-w-0 flex-col gap-2' },
            'section-heading': { class: 'flex items-center gap-2 px-0.5' },
            'section-title': { class: 'text-sm font-semibold' },
            'section-count': { class: 'text-xs text-base-content/55' },
            list: { class: 'flex min-w-0 flex-col gap-2' },
            file: {
                class: [
                    'flex min-h-16 min-w-0 items-center gap-3 rounded-box border border-base-300 bg-base-100 p-2.5',
                    'transition-colors',
                    'data-[status=rejected]:border-error/30 data-[status=rejected]:bg-error/5',
                    'data-[status=error]:border-error/30 data-[status=error]:bg-error/5',
                    'data-[status=cancelled]:border-warning/30 data-[status=cancelled]:bg-warning/5',
                ],
            },
            preview: {
                class: 'relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-field bg-base-200',
            },
            'preview-image': { class: 'size-full object-cover' },
            'preview-icon': { class: 'shrink-0' },
            ...icons,
            extension: {
                class: 'absolute bottom-0.5 right-0.5 rounded bg-base-300/90 px-1 text-[0.5rem] font-bold leading-3.5',
            },
            metadata: { class: 'min-w-0 grow' },
            name: { class: 'block truncate text-sm font-medium' },
            details: { class: 'block truncate text-xs text-base-content/55' },
            'progress-wrapper': { class: 'mt-1.5 flex items-center gap-2' },
            progress: { class: 'progress progress-primary h-1.5 min-w-0 grow' },
            'progress-value': { class: 'w-9 shrink-0 text-right text-[0.7rem] tabular-nums text-base-content/60' },
            'file-error': { class: 'mt-1 text-xs leading-tight text-error' },
            actions: { class: 'flex shrink-0 items-center gap-0.5' },
            status: { class: 'inline-flex size-8 shrink-0 items-center justify-center' },
            'status-text': { class: 'sr-only' },
            'status-icon': { class: 'size-5' },
            'status-icon-complete': { class: 'i-tabler-circle-check-filled text-success' },
            'status-icon-uploading': { class: 'i-tabler-loader-2 animate-spin text-primary' },
            'status-icon-queued': { class: 'i-tabler-clock text-base-content/45' },
            'status-icon-attention': { class: 'i-tabler-alert-triangle-filled text-error' },
            'status-icon-cancelled': { class: 'i-tabler-circle-minus text-warning' },
            'upload-action': { class: 'btn btn-ghost btn-square btn-sm min-h-10 min-w-10' },
            'retry-action': { class: 'btn btn-ghost btn-square btn-sm min-h-10 min-w-10' },
            'cancel-action': { class: 'btn btn-ghost btn-square btn-sm min-h-10 min-w-10' },
            'remove-action': { class: 'btn btn-ghost btn-square btn-sm min-h-10 min-w-10 text-base-content/60' },
            'upload-icon': { class: 'i-tabler-upload' },
            'retry-icon': { class: 'i-tabler-refresh' },
            'cancel-icon': { class: 'i-tabler-player-stop' },
            'remove-icon': { class: 'i-tabler-trash' },
            empty: { class: 'rounded-box border border-dashed border-base-300 p-4 text-center text-sm text-base-content/55' },
            error: { class: 'mt-1 px-1 text-sm text-error' },
            'trigger-shell': { class: ['input group w-full', size, color, variant] },
            trigger: {
                class: [
                    'flex h-full min-w-0 grow cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left',
                    'font-[inherit] text-[inherit] text-base-content outline-none',
                    'disabled:cursor-not-allowed disabled:text-base-content/40',
                ],
            },
            value: { class: 'min-w-0 grow truncate' },
            placeholder: { class: 'min-w-0 grow truncate text-base-content/60' },
            prepend: { class: 'inline-flex shrink-0 items-center' },
            'trigger-icon': { class: 'i-tabler-paperclip shrink-0 opacity-70' },
            'trigger-indicator': {
                class: 'i-tabler-chevron-down shrink-0 opacity-65 transition-transform data-[open]:rotate-180',
            },
            'add-action': { class: 'btn btn-ghost btn-circle btn-sm -me-1 shrink-0' },
            'add-icon': { class: 'i-tabler-plus' },
            overlay: { class: 'max-w-[calc(100vw-1rem)]' },
            panel: {
                class: [
                    'flex w-[min(36rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] min-h-0 flex-col overflow-hidden',
                    'border border-base-300 bg-base-100 p-0 shadow-xl',
                    'data-[presentation=dialog]:w-[calc(100vw-1rem)] data-[presentation=dialog]:rounded-t-box',
                ],
            },
            header: {
                class: [
                    'flex shrink-0 items-start justify-between gap-3 border-b border-base-300 px-4 py-3.5',
                    'data-[presentation=dialog]:px-5 data-[presentation=dialog]:pt-5',
                ],
            },
            'header-copy': { class: 'min-w-0 grow' },
            title: { class: 'truncate text-lg font-semibold leading-tight' },
            description: { class: 'mt-1 text-sm leading-snug text-base-content/55' },
            'header-actions': { class: 'flex shrink-0 items-center gap-1' },
            count: {
                class: component?.state?.presentation === 'dialog'
                    ? 'mt-1 block text-sm text-base-content/55'
                    : 'badge badge-soft badge-primary badge-sm whitespace-nowrap',
            },
            'dialog-close': { class: 'btn btn-ghost btn-circle btn-sm min-h-10 min-w-10' },
            'dialog-close-icon': { class: 'i-tabler-x size-5' },
            footer: {
                class: [
                    'shrink-0 border-t border-base-300 bg-base-100 px-4 py-3',
                    'data-[presentation=dialog]:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                ],
            },
            'done-action': { class: 'btn btn-primary w-full' },
        },
    };
}
