import { isPlainObject } from '../support/value.js';

export const DISPLAY_BREAKPOINTS = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl', 'xxl']);

export const DEFAULT_DISPLAY_THRESHOLDS = Object.freeze({
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    xxl: 1536,
});

export const DEFAULT_DISPLAY_OPTIONS = Object.freeze({
    mobileBreakpoint: 'lg',
    thresholds: DEFAULT_DISPLAY_THRESHOLDS,
});

const DISPLAY_OPTION_KEYS = new Set(['mobileBreakpoint', 'thresholds']);
const DISPLAY_BREAKPOINT_KEYS = new Set(DISPLAY_BREAKPOINTS);

function validatePixelValue(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be a finite, non-negative number.`);
    }
}

function normalizeThresholds(current, overrides) {
    if (!isPlainObject(overrides)) {
        throw new Error('Display thresholds must be a plain object.');
    }

    for (const key of Object.keys(overrides)) {
        if (!DISPLAY_BREAKPOINT_KEYS.has(key)) {
            throw new Error(`Unknown display threshold '${key}'.`);
        }
        validatePixelValue(overrides[key], `Display threshold '${key}'`);
    }

    const thresholds = { ...current, ...overrides };
    if (thresholds.xs !== 0) {
        throw new Error("Display threshold 'xs' must be 0.");
    }

    for (let index = 1; index < DISPLAY_BREAKPOINTS.length; index += 1) {
        const previous = DISPLAY_BREAKPOINTS[index - 1];
        const currentName = DISPLAY_BREAKPOINTS[index];
        if (thresholds[currentName] <= thresholds[previous]) {
            throw new Error('Display thresholds must be strictly increasing.');
        }
    }

    return Object.freeze(thresholds);
}

function validateMobileBreakpoint(value) {
    if (typeof value === 'number') {
        validatePixelValue(value, 'Display mobileBreakpoint');
        return;
    }

    if (typeof value !== 'string' || !DISPLAY_BREAKPOINT_KEYS.has(value)) {
        throw new Error(
            `Display mobileBreakpoint must be a non-negative number or one of: ${DISPLAY_BREAKPOINTS.join(', ')}.`,
        );
    }
}

function viewportSize() {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return {
        width: Number.isFinite(window.innerWidth) ? window.innerWidth : 0,
        height: Number.isFinite(window.innerHeight) ? window.innerHeight : 0,
    };
}

function supportsTouch(browserWindow) {
    const points = Number(browserWindow?.navigator?.maxTouchPoints ?? 0);
    return points > 0 || 'ontouchstart' in browserWindow;
}

export function detectDisplayPlatform(browserWindow = typeof window === 'undefined' ? null : window) {
    if (!browserWindow) {
        return Object.freeze({
            android: false,
            ios: false,
            cordova: false,
            electron: false,
            chrome: false,
            edge: false,
            firefox: false,
            opera: false,
            win: false,
            mac: false,
            linux: false,
            touch: false,
            ssr: true,
        });
    }

    const userAgent = String(browserWindow.navigator?.userAgent ?? '');
    const touch = supportsTouch(browserWindow);
    const android = /android/i.test(userAgent);
    const ios = /iphone|ipad|ipod/i.test(userAgent)
        || (/macintosh/i.test(userAgent) && Number(browserWindow.navigator?.maxTouchPoints ?? 0) > 1);
    const edge = /edg(?:e|a|ios)?\//i.test(userAgent);
    const opera = /opera|opr\//i.test(userAgent);

    return Object.freeze({
        android,
        ios,
        cordova: /cordova/i.test(userAgent),
        electron: /electron/i.test(userAgent),
        chrome: !edge && !opera && /chrome|crios/i.test(userAgent),
        edge,
        firefox: /firefox|fxios/i.test(userAgent),
        opera,
        win: /windows|win32|win64/i.test(userAgent),
        mac: !ios && /macintosh|mac os x/i.test(userAgent),
        linux: !android && /linux/i.test(userAgent),
        touch,
        ssr: false,
    });
}

export function deriveDisplayState(width, thresholds, mobileBreakpoint) {
    const activeIndex = DISPLAY_BREAKPOINTS.reduce((result, name, index) => (
        width >= thresholds[name] ? index : result
    ), 0);
    const name = DISPLAY_BREAKPOINTS[activeIndex];
    const mobileThreshold = typeof mobileBreakpoint === 'number'
        ? mobileBreakpoint
        : thresholds[mobileBreakpoint];

    return {
        xs: name === 'xs',
        sm: name === 'sm',
        md: name === 'md',
        lg: name === 'lg',
        xl: name === 'xl',
        xxl: name === 'xxl',
        smAndUp: width >= thresholds.sm,
        mdAndUp: width >= thresholds.md,
        lgAndUp: width >= thresholds.lg,
        xlAndUp: width >= thresholds.xl,
        smAndDown: width < thresholds.md,
        mdAndDown: width < thresholds.lg,
        lgAndDown: width < thresholds.xl,
        xlAndDown: width < thresholds.xxl,
        name,
        mobile: width < mobileThreshold,
    };
}

export class DisplayService {
    constructor() {
        this.options = {
            mobileBreakpoint: DEFAULT_DISPLAY_OPTIONS.mobileBreakpoint,
            thresholds: DEFAULT_DISPLAY_OPTIONS.thresholds,
        };
        this._state = null;
        this._installed = false;
        this._resize = this.update.bind(this);
    }

    configure(options = {}) {
        if (this._installed) {
            throw new Error('Display must be configured before the x-isas Alpine plugin is installed.');
        }
        if (!isPlainObject(options)) {
            throw new Error('Display configuration must be a plain object.');
        }

        for (const key of Object.keys(options)) {
            if (!DISPLAY_OPTION_KEYS.has(key)) {
                throw new Error(`Unknown display option '${key}'.`);
            }
        }

        const thresholds = options.thresholds === undefined
            ? this.options.thresholds
            : normalizeThresholds(this.options.thresholds, options.thresholds);
        const mobileBreakpoint = options.mobileBreakpoint === undefined
            ? this.options.mobileBreakpoint
            : options.mobileBreakpoint;
        validateMobileBreakpoint(mobileBreakpoint);

        this.options = { thresholds, mobileBreakpoint };
        return this;
    }

    install(Alpine) {
        if (this._installed) return this._state;
        if (!Alpine || typeof Alpine.reactive !== 'function') {
            throw new Error('Display installation requires Alpine.reactive.');
        }

        const { width, height } = viewportSize();
        const { thresholds, mobileBreakpoint } = this.options;
        this._state = Alpine.reactive({
            width,
            height,
            ...deriveDisplayState(width, thresholds, mobileBreakpoint),
            mobileBreakpoint,
            thresholds,
            platform: detectDisplayPlatform(),
        });
        this._installed = true;

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._resize, { passive: true });
        }

        return this._state;
    }

    get state() {
        if (!this._state) {
            throw new Error('Display state is available after the x-isas Alpine plugin is installed.');
        }
        return this._state;
    }

    update() {
        if (!this._state) return;
        const { width, height } = viewportSize();
        const { thresholds, mobileBreakpoint } = this.options;
        Object.assign(this._state, {
            width,
            height,
            ...deriveDisplayState(width, thresholds, mobileBreakpoint),
            platform: detectDisplayPlatform(),
        });
    }
}

export const display = new DisplayService();
