const SIZE_CLASSES = Object.freeze({
    xs: 'otp-xs',
    sm: 'otp-sm',
    md: 'otp-md',
    lg: 'otp-lg',
    xl: 'otp-xl',
});

const COLOR_CLASSES = Object.freeze({
    neutral: 'otp-neutral',
    primary: 'otp-primary',
    secondary: 'otp-secondary',
    accent: 'otp-accent',
    info: 'otp-info',
    success: 'otp-success',
    warning: 'otp-warning',
    error: 'otp-error',
});

export function otpAdapter({ attrs }) {
    const invalid = attrs.boolean('invalid');
    const color = invalid
        ? COLOR_CLASSES.error
        : (COLOR_CLASSES[attrs.get('color')] ?? '');
    const size = SIZE_CLASSES[attrs.get('size')] ?? '';
    const joined = attrs.boolean('joined') ? 'otp-joined' : '';

    return {
        host: {
            class: ['otp', size, color, joined],
        },
    };
}
