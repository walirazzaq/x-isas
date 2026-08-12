const ERROR_MESSAGES = Object.freeze({
    TOO_MANY_FILES: 'Too many files selected.',
    FILE_INVALID_TYPE: 'This file type is not accepted.',
    FILE_TOO_LARGE: 'This file is too large.',
    FILE_TOO_SMALL: 'This file is too small.',
    FILE_EXISTS: 'This file has already been selected.',
});

export function fileFingerprint(file) {
    return [file?.name, file?.size, file?.type, file?.lastModified]
        .map((value) => String(value ?? ''))
        .join(':');
}

export function fileExtension(file) {
    const name = String(file?.name ?? '');
    const index = name.lastIndexOf('.');
    if (index <= 0 || index === name.length - 1) return 'FILE';
    return name.slice(index + 1).toUpperCase().slice(0, 8);
}

export function fileCategory(file) {
    const type = String(file?.type ?? '').toLowerCase();
    const extension = fileExtension(file).toLowerCase();
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf' || extension === 'pdf') return 'pdf';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('text/')) return 'text';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
    if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) return 'document';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(extension)) return 'spreadsheet';
    if (['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'php', 'py', 'rb'].includes(extension)) return 'code';
    return 'file';
}

export function formatFileSize(size, locale = 'en-US') {
    const bytes = Number(size) || 0;
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${new Intl.NumberFormat(locale, {
        maximumFractionDigits: index === 0 ? 0 : 1,
    }).format(value)} ${units[index]}`;
}

export function normalizeFileErrors(errors) {
    return [...new Set((Array.isArray(errors) ? errors : [errors])
        .filter((error) => error !== null && error !== undefined && error !== '')
        .map((error) => ERROR_MESSAGES[String(error)] ?? String(error)))];
}
