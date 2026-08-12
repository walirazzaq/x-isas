function resolvedAttribute(primary, fallback, name) {
    if (primary?.has(name)) {
        return { present: true, value: primary.get(name) };
    }

    if (fallback?.has(name)) {
        return { present: true, value: fallback.get(name) };
    }

    return { present: false, value: null };
}

export function numericProgressValue(raw, fallback) {
    const value = Number(raw);
    return Number.isNaN(value) ? fallback : value;
}

export function progressPercentage(value, max) {
    if (!Number.isFinite(max) || max <= 0) return 0;

    const ratio = (value / max) * 100;
    return Math.max(0, Math.min(100, ratio));
}

export function resolveProgressState(
    primary,
    fallback = null,
    { indeterminateWhenMissing = false } = {},
) {
    const resolvedValue = resolvedAttribute(primary, fallback, 'value');
    const resolvedMax = resolvedAttribute(primary, fallback, 'max');
    const determinate = resolvedValue.present || !indeterminateWhenMissing;
    const value = determinate
        ? numericProgressValue(resolvedValue.present ? resolvedValue.value : 0, 0)
        : null;
    const max = numericProgressValue(resolvedMax.present ? resolvedMax.value : 100, 100);

    return {
        determinate,
        value,
        max,
        maxPresent: resolvedMax.present,
        percentage: determinate ? progressPercentage(value, max) : null,
    };
}
