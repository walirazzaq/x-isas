import { CalendarDate, parseDate } from '@internationalized/date';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseCalendarDate(value) {
    const normalized = String(value ?? '').trim();
    if (!DATE_PATTERN.test(normalized)) return null;
    try {
        const parsed = parseDate(normalized);
        return parsed.toString() === normalized ? parsed : null;
    } catch {
        return null;
    }
}

export function todayDate(value = null) {
    const configured = parseCalendarDate(value);
    if (configured) return configured;
    const now = new Date();
    return new CalendarDate(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        now.getUTCDate(),
    );
}

export function parseCalendarValue(value, selection = 'single') {
    const normalized = String(value ?? '').trim();
    if (!normalized) return { value: '', dates: [], valid: true };

    if (selection === 'range') {
        const pieces = normalized.split('/');
        if (pieces.length !== 2) return { value: '', dates: [], valid: false };
        const dates = pieces.map(parseCalendarDate);
        if (dates.some((date) => !date) || dates[0].compare(dates[1]) > 0) {
            return { value: '', dates: [], valid: false };
        }
        return { value: dates.map(String).join('/'), dates, valid: true };
    }

    const date = parseCalendarDate(normalized);
    return date
        ? { value: date.toString(), dates: [date], valid: true }
        : { value: '', dates: [], valid: false };
}

export function serializeDates(dates, selection = 'single') {
    const values = dates.filter(Boolean).map(String);
    if (selection === 'range') return values.length === 2 ? values.join('/') : '';
    return values[0] ?? '';
}

export function presetDates(name, base, startOfWeek = 1) {
    switch (String(name ?? '').trim().toLowerCase()) {
        case 'today':
            return [base];
        case 'last-3-days':
            return [base.subtract({ days: 2 }), base];
        case 'last-7-days':
            return [base.subtract({ days: 6 }), base];
        case 'previous-week': { // startOfWeek follows Zag's 0=Sunday convention.
            const jsDay = new Date(Date.UTC(base.year, base.month - 1, base.day)).getUTCDay();
            const offset = (jsDay - startOfWeek + 7) % 7;
            const end = base.subtract({ days: offset + 1 });
            return [end.subtract({ days: 6 }), end];
        }
        case 'previous-month': {
            const end = new CalendarDate(base.year, base.month, 1).subtract({ days: 1 });
            return [new CalendarDate(end.year, end.month, 1), end];
        }
        default:
            return [];
    }
}

export function formatCalendarValue(value, selection, locale, dateStyle = 'medium') {
    const parsed = parseCalendarValue(value, selection);
    if (!parsed.valid || !parsed.dates.length) return '';
    const allowedStyles = new Set(['full', 'long', 'medium', 'short']);
    const formatter = new Intl.DateTimeFormat(locale || 'en-US', {
        dateStyle: allowedStyles.has(dateStyle) ? dateStyle : 'medium',
        timeZone: 'UTC',
    });
    const nativeDates = parsed.dates.map((date) => new Date(
        Date.UTC(date.year, date.month - 1, date.day),
    ));
    if (selection === 'range'
        && nativeDates.length === 2
        && typeof formatter.formatRange === 'function') {
        return formatter.formatRange(nativeDates[0], nativeDates[1]);
    }
    return nativeDates.map((date) => formatter.format(date)).join(' – ');
}
