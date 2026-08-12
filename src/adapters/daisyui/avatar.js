import { resolveAvatarContent } from '../../components/avatar/avatar.js';

const SIZE_CLASSES = Object.freeze({
    xs: 'size-6 text-xs',
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-sm',
    xl: 'size-14 text-base',
    adaptive: 'size-[2.25em] text-[0.65em]',
});

const COLOR_CLASSES = Object.freeze({
    neutral: 'bg-neutral text-neutral-content',
    primary: 'bg-primary text-primary-content',
    secondary: 'bg-secondary text-secondary-content',
    accent: 'bg-accent text-accent-content',
    success: 'bg-success text-success-content',
    warning: 'bg-warning text-warning-content',
    error: 'bg-error text-error-content',
    info: 'bg-info text-info-content',
});

const STATUS_CLASSES = Object.freeze({
    online: 'avatar-online',
    offline: 'avatar-offline',
});

export function avatarAdapter({ attrs, slots }) {
    const size = SIZE_CLASSES[attrs.get('size', 'md')] ?? '';
    const color = COLOR_CLASSES[attrs.get('color', 'neutral')] ?? '';
    const status = STATUS_CLASSES[attrs.get('status')] ?? '';
    const { placeholder } = resolveAvatarContent(attrs, slots);

    return {
        host: {
            class: ['avatar', status, placeholder ? 'avatar-placeholder' : ''],
        },
        parts: {
            content: {
                class: [size, color],
            },
        },
    };
}
