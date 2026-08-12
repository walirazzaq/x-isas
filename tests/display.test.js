import Alpine from 'alpinejs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import isas, { display } from '../src/index.js';
import {
    DEFAULT_DISPLAY_THRESHOLDS,
    DisplayService,
    deriveDisplayState,
    detectDisplayPlatform,
} from '../src/display/display.js';

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

function resize(width, height = window.innerHeight) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    window.dispatchEvent(new Event('resize'));
}

async function tick() {
    await Promise.resolve();
    await Alpine.nextTick();
    await Promise.resolve();
}

function mount(html) {
    document.body.innerHTML = html;
    Alpine.initTree(document.body);
    return document.body.firstElementChild;
}

beforeAll(() => {
    resize(1024, 768);
    globalThis.Alpine = Alpine;
    Alpine.plugin(isas);
});

afterEach(async () => {
    Alpine.destroyTree(document.body);
    document.body.replaceChildren();
    await tick();
});

afterAll(() => {
    resize(originalWidth, originalHeight);
    delete globalThis.Alpine;
});

describe('display breakpoint calculations', () => {
    it.each([
        [0, 'xs'],
        [639, 'xs'],
        [640, 'sm'],
        [767, 'sm'],
        [768, 'md'],
        [1023, 'md'],
        [1024, 'lg'],
        [1279, 'lg'],
        [1280, 'xl'],
        [1535, 'xl'],
        [1536, 'xxl'],
    ])('selects %s as %s at exact Tailwind boundaries', (width, name) => {
        const state = deriveDisplayState(width, DEFAULT_DISPLAY_THRESHOLDS, 'lg');
        expect(state.name).toBe(name);
        expect(state[name]).toBe(true);
        expect(['xs', 'sm', 'md', 'lg', 'xl', 'xxl'].filter((key) => state[key]))
            .toEqual([name]);
    });

    it('calculates inclusive up ranges and exclusive down and mobile ranges', () => {
        const below = deriveDisplayState(767, DEFAULT_DISPLAY_THRESHOLDS, 'md');
        expect(below).toMatchObject({
            smAndUp: true,
            mdAndUp: false,
            smAndDown: true,
            mobile: true,
        });

        const boundary = deriveDisplayState(768, DEFAULT_DISPLAY_THRESHOLDS, 'md');
        expect(boundary).toMatchObject({
            smAndUp: true,
            mdAndUp: true,
            smAndDown: false,
            mobile: false,
        });
    });
});

describe('display configuration', () => {
    it('merges repeated partial configuration before installation', () => {
        const service = new DisplayService();
        expect(service.configure({ thresholds: { md: 800, lg: 1100 } })).toBe(service);
        service.configure({ thresholds: { xl: 1400 }, mobileBreakpoint: 900 });

        expect(service.options).toEqual({
            mobileBreakpoint: 900,
            thresholds: {
                xs: 0,
                sm: 640,
                md: 800,
                lg: 1100,
                xl: 1400,
                xxl: 1536,
            },
        });
        expect(Object.isFrozen(service.options.thresholds)).toBe(true);
    });

    it.each([
        [{ unknown: true }, "Unknown display option 'unknown'."],
        [{ thresholds: [] }, 'Display thresholds must be a plain object.'],
        [{ thresholds: { tablet: 700 } }, "Unknown display threshold 'tablet'."],
        [{ thresholds: { xs: 1 } }, "Display threshold 'xs' must be 0."],
        [{ thresholds: { md: 640 } }, 'Display thresholds must be strictly increasing.'],
        [{ thresholds: { md: Number.NaN } }, "Display threshold 'md' must be a finite, non-negative number."],
        [{ mobileBreakpoint: 'tablet' }, 'Display mobileBreakpoint must be a non-negative number or one of: xs, sm, md, lg, xl, xxl.'],
        [{ mobileBreakpoint: -1 }, 'Display mobileBreakpoint must be a finite, non-negative number.'],
    ])('rejects invalid configuration %#', (configuration, message) => {
        expect(() => new DisplayService().configure(configuration)).toThrow(message);
    });

    it('locks configuration after installation and installs one resize listener', () => {
        const addEventListener = vi.spyOn(window, 'addEventListener');
        const service = new DisplayService();
        const state = service.install(Alpine);

        expect(service.install(Alpine)).toBe(state);
        expect(addEventListener.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
        expect(() => service.configure({ mobileBreakpoint: 'md' })).toThrow(
            'Display must be configured before the x-isas Alpine plugin is installed.',
        );
        addEventListener.mockRestore();
    });
});

describe('Alpine $display magic', () => {
    it('shares one stable reactive state with JavaScript consumers', async () => {
        resize(1024, 768);
        const state = display.state;
        const root = mount(`
            <div x-data>
                <span x-text="$display.name + ':' + $display.width + 'x' + $display.height"></span>
                <strong x-show="$display.lgAndUp">wide</strong>
            </div>
        `);
        await tick();

        expect(root.querySelector('span').textContent).toBe('lg:1024x768');
        expect(root.querySelector('strong').style.display).not.toBe('none');

        resize(767, 600);
        await tick();

        expect(display.state).toBe(state);
        expect(state).toMatchObject({ width: 767, height: 600, name: 'sm', mobile: true });
        expect(root.querySelector('span').textContent).toBe('sm:767x600');
        expect(root.querySelector('strong').style.display).toBe('none');
    });

    it('exposes immutable thresholds and the configured mobile breakpoint', () => {
        expect(display.state.thresholds).toEqual(DEFAULT_DISPLAY_THRESHOLDS);
        expect(Object.isFrozen(display.state.thresholds)).toBe(true);
        expect(display.state.mobileBreakpoint).toBe('lg');
    });
});

describe('display platform detection', () => {
    it('detects representative browser, operating-system, and touch flags', () => {
        const platform = detectDisplayPlatform({
            navigator: {
                maxTouchPoints: 5,
                userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/123.0 Mobile Safari/537.36',
            },
        });

        expect(platform).toMatchObject({
            android: true,
            chrome: true,
            linux: false,
            touch: true,
            ssr: false,
        });
    });

    it('returns an explicit SSR platform when no browser exists', () => {
        expect(detectDisplayPlatform(null)).toEqual({
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
    });
});
