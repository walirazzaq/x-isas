import Alpine from 'alpinejs';
import morph from '@alpinejs/morph';
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import isas, {
    Calendar,
    DatePicker,
    DatePreset,
    HostRuntime,
    Isas,
    calendarAdapter,
    datePickerAdapter,
} from '../src/calendar.js';
import {
    formatCalendarValue,
    parseCalendarValue,
    presetDates,
    todayDate,
} from '../src/components/calendar/value.js';

const tick = async () => {
    await Promise.resolve();
    await Alpine.nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

function mount(html) {
    document.body.innerHTML = html;
    Alpine.initTree(document.body);
    return document.body.firstElementChild;
}

beforeAll(() => {
    globalThis.Alpine = Alpine;
    Alpine.plugin(morph);
    Alpine.plugin(isas);
});

afterEach(async () => {
    Alpine.destroyTree(document.body);
    document.body.replaceChildren();
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('calendar opt-in entry', () => {
    it('normalizes canonical values and fixed-date preset boundaries', () => {
        expect(parseCalendarValue('2026-08-04', 'single').valid).toBe(true);
        expect(parseCalendarValue('08/04/2026', 'single').valid).toBe(false);
        expect(parseCalendarValue('2026-08-10/2026-08-04', 'range').valid).toBe(false);

        const base = todayDate('2026-08-04');
        expect(presetDates('last-7-days', base).map(String)).toEqual([
            '2026-07-29',
            '2026-08-04',
        ]);
        expect(presetDates('previous-week', base, 1).map(String)).toEqual([
            '2026-07-27',
            '2026-08-02',
        ]);
        expect(presetDates('previous-month', base).map(String)).toEqual([
            '2026-07-01',
            '2026-07-31',
        ]);
    });

    it('formats localized values and collapses ranges with a safe fallback', () => {
        const medium = formatCalendarValue(
            '2026-08-10/2026-08-16',
            'range',
            'en-US',
            'medium',
        );
        expect(medium).toContain('Aug');
        expect(medium).toContain('2026');
        expect(medium.length).toBeLessThan('Aug 10, 2026 – Aug 16, 2026'.length);
        expect(formatCalendarValue('2026-08-10', 'single', 'de-DE', 'long'))
            .toContain('August 2026');
        expect(new Set(['full', 'long', 'medium', 'short'].map((style) => (
            formatCalendarValue('2026-08-10', 'single', 'en-US', style)
        ))).size).toBe(4);
        expect(formatCalendarValue('2026-08-10', 'single', 'en-US', 'not-a-style'))
            .toBe(formatCalendarValue('2026-08-10', 'single', 'en-US', 'medium'));

        const descriptor = Object.getOwnPropertyDescriptor(
            Intl.DateTimeFormat.prototype,
            'formatRange',
        );
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', {
            ...descriptor,
            configurable: true,
            value: undefined,
        });
        try {
            expect(formatCalendarValue(
                '2026-08-10/2026-08-16',
                'range',
                'en-US',
                'medium',
            )).toBe('Aug 10, 2026 – Aug 16, 2026');
        } finally {
            if (descriptor) {
                Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', descriptor);
            } else delete Intl.DateTimeFormat.prototype.formatRange;
        }
    });

    it('registers calendar features without adding them to the default entry', () => {
        expect(Isas.components.get('calendar')).toBe(Calendar);
        expect(Isas.components.get('date-picker')).toBe(DatePicker);
        expect(Isas.components.get('date-preset')).toBe(DatePreset);
        expect(Isas.adapters.get('calendar')).toBe(calendarAdapter);
        expect(Isas.adapters.get('date-picker')).toBe(datePickerAdapter);
    });

    it('commits a single canonical value and updates native forms', async () => {
        const form = mount(`
            <form>
                <div x-is="calendar" name="arrival" today="2026-08-04"></div>
            </form>
        `);
        await tick();
        const host = form.firstElementChild;
        const day = host.querySelector('[data-zag-day-trigger][data-value="2026-08-12"]');

        expect(day).not.toBeNull();
        day.click();
        await tick();

        expect(host.value).toBe('2026-08-12');
        expect(new FormData(form).get('arrival')).toBe('2026-08-12');
        expect(Alpine.$data(host).$calendar.value).toBe('2026-08-12');
    });

    it('uses compact fit layout by default and explicit fill layout across views', async () => {
        const wrapper = mount(`
            <div>
                <div x-is="calendar" today="2026-08-04" layout="unknown"></div>
                <div x-is="calendar" today="2026-08-04" layout="fill" months="2"></div>
            </div>
        `);
        await tick();
        const [fit, fill] = wrapper.children;
        expect(fit.dataset.layout).toBe('fit');
        expect(fit.querySelector('[data-zag-view="day"] section').style.width).toBe('18rem');
        expect(fill.dataset.layout).toBe('fill');
        expect(fill.classList).toContain('w-full');
        expect(fill.querySelector('[data-zag-view="day"] section').style.flex).toContain('1 1 18rem');

        const fitWidth = '18rem';
        fit.querySelector('[data-zag-action="view"]').click();
        await tick();
        expect(fit.querySelector('[data-zag-view="month"]').style.width).toBe(fitWidth);
        fit.querySelector('[data-zag-action="view"]').click();
        await tick();
        expect(fit.querySelector('[data-zag-view="year"]').style.width).toBe(fitWidth);
    });

    it('derives implicit DatePicker layout from presentation and honors explicit layout', async () => {
        const wrapper = mount(`
            <div>
                <div x-is="date-picker" mode="dropdown"></div>
                <div x-is="date-picker" mode="dialog"></div>
                <div x-is="date-picker" mode="dialog" layout="fit"></div>
                <div x-is="date-picker" mode="dropdown" layout="fill"></div>
            </div>
        `);
        await tick();
        expect([...wrapper.children].map((element) => element.dataset.layout)).toEqual([
            'fit',
            'fill',
            'fit',
            'fill',
        ]);
        expect(wrapper.children[1].classList).not.toContain('w-full');
        expect(wrapper.children[3].classList).not.toContain('w-full');
    });

    it('renders initial DatePicker models and supports custom value display content', async () => {
        const wrapper = mount(`
            <div x-data="{ range: '2026-08-10/2026-08-16' }">
                <div x-is="date-picker" x-model="range" selection="range"
                    locale="en-US" date-style="medium" placeholder="Choose dates">
                    <span slot="value" data-custom-display
                        x-text="'Custom: ' + $datePicker.value"></span>
                </div>
            </div>
        `);
        await tick();
        const picker = wrapper.firstElementChild;
        expect(Alpine.$data(picker).$datePicker.value).toBe('2026-08-10/2026-08-16');
        expect(HostRuntime.from(picker).componentFor('date-picker').view.displayValue).toContain('Aug');
        const trigger = picker.querySelector('[data-isas-date-picker-trigger]');
        expect(trigger.textContent).toContain('Custom: 2026-08-10/2026-08-16');
        expect(trigger.getAttribute('aria-label')).toContain('Aug');
        expect(Alpine.$data(picker).$datePicker.displayValue).toContain('Aug');

        picker.querySelector('[data-zag-day-trigger][data-value="2026-08-20"]').click();
        await tick();
        expect(trigger.textContent).toContain('Custom: 2026-08-10/2026-08-16');
        expect(Alpine.$data(picker).$datePicker.draft).toBe('2026-08-20');
    });

    it('uses the placeholder instead of the value slot for an empty DatePicker', async () => {
        const picker = mount(`
            <div x-is="date-picker" placeholder="Choose dates">
                <span slot="value" data-custom-display>Custom value</span>
            </div>
        `);
        await tick();
        const trigger = picker.querySelector('[data-isas-date-picker-trigger]');
        expect(trigger.textContent).toContain('Choose dates');
        expect(trigger.querySelector('[data-custom-display]')).toBeNull();
        expect(trigger.getAttribute('aria-label')).toBe('Choose dates');
    });

    it('gives DatePicker the Input styling contract without composing Input', async () => {
        const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];
        const colors = [
            'neutral', 'primary', 'secondary', 'accent',
            'info', 'success', 'warning', 'error',
        ];
        const wrapper = mount(`
            <div>
                ${sizes.map((size) => `
                    <label x-is="input" size="${size}"></label>
                    <div x-is="date-picker" size="${size}"></div>
                `).join('')}
                ${colors.map((color) => `
                    <div x-is="date-picker" color="${color}"></div>
                `).join('')}
                <div x-is="date-picker" variant="ghost"></div>
                <div x-is="date-picker" size="unknown" color="unknown"
                    variant="unknown"></div>
            </div>
        `);
        await tick();

        const children = [...wrapper.children];
        sizes.forEach((size, index) => {
            const input = children[index * 2];
            const picker = children[(index * 2) + 1];
            const shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
            expect(shell.classList).toContain(`input-${size}`);
            expect(input.classList).toContain(`input-${size}`);
            expect(picker.querySelector('[x-is="input"]')).toBeNull();
            expect(picker.querySelector('[data-isas-date-picker-trigger]').classList)
                .not.toContain('input');
        });

        colors.forEach((color, index) => {
            const picker = children[(sizes.length * 2) + index];
            expect(picker.querySelector('[data-isas-date-picker-trigger-shell]').classList)
                .toContain(`input-${color}`);
        });
        expect(children[18].querySelector('[data-isas-date-picker-trigger-shell]').classList)
            .toContain('input-ghost');
        expect(children[19].querySelector('[data-isas-date-picker-trigger-shell]').className)
            .toBe('input group w-full');
    });

    it('reactively replaces DatePicker styles and lets validation override color', async () => {
        const wrapper = mount(`
            <div x-data="{ size: 'xs', color: 'primary', variant: 'ghost', error: '' }">
                <div x-is="date-picker" :size="size" :color="color"
                    :variant="variant" :error="error"></div>
            </div>
        `);
        await tick();
        const picker = wrapper.firstElementChild;
        let shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.className).toContain('input-xs');
        expect(shell.className).toContain('input-primary');
        expect(shell.className).toContain('input-ghost');

        const data = Alpine.$data(wrapper);
        data.size = 'xl';
        data.color = 'success';
        data.variant = 'unknown';
        await tick();
        shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.className).toContain('input-xl');
        expect(shell.className).toContain('input-success');
        expect(shell.className).not.toContain('input-xs');
        expect(shell.className).not.toContain('input-primary');
        expect(shell.className).not.toContain('input-ghost');

        data.error = 'Choose a valid date';
        await tick();
        shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.className).toContain('input-error');
        expect(shell.className).not.toContain('input-success');

        data.error = '';
        await tick();
        shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.className).toContain('input-success');
        expect(shell.className).not.toContain('input-error');
    });

    it('rerenders Input styling when native DatePicker validity becomes visible', async () => {
        const picker = mount(`
            <div x-is="date-picker" required color="success"
                today="2026-08-04"></div>
        `);
        await tick();
        const component = HostRuntime.from(picker).componentFor('date-picker');

        expect(component.reportValidity()).toBe(false);
        await tick();
        let shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.classList).toContain('input-error');
        expect(shell.classList).not.toContain('input-success');
        expect(picker.querySelector('[data-isas-date-picker-trigger]')
            .getAttribute('aria-invalid')).toBe('true');

        component.commitValue('2026-08-12');
        await tick();
        shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.classList).toContain('input-success');
        expect(shell.classList).not.toContain('input-error');
    });

    it('supports generated and authored DatePicker accessories with defined precedence', async () => {
        const wrapper = mount(`
            <div>
                <div x-is="date-picker" icon="i-leading" icon:class="lead-authored"
                    icon-end="i-trailing" icon-end:class="trail-authored"></div>
                <div x-is="date-picker"></div>
                <div x-is="date-picker" icon="i-ignored" icon-end="i-ignored-end">
                    <span slot="prepend" x-is="badge" data-authored-prepend>Lead</span>
                    <button slot="append" type="button" data-authored-append>Action</button>
                </div>
            </div>
        `);
        await tick();
        const [generated, defaults, authored] = wrapper.children;

        expect(generated.querySelector('[data-isas-date-picker-prepend] .i-leading'))
            .not.toBeNull();
        expect(generated.querySelector('.i-leading').classList).toContain('lead-authored');
        expect(generated.querySelector('[data-isas-date-picker-append] .i-trailing'))
            .not.toBeNull();
        expect(generated.querySelector('.i-trailing').classList).toContain('trail-authored');
        expect(generated.querySelector('.i-tabler-calendar')).toBeNull();

        expect(defaults.querySelector('[data-isas-date-picker-append] .i-tabler-calendar'))
            .not.toBeNull();
        expect(authored.querySelector('[data-authored-prepend].badge')).not.toBeNull();
        expect(authored.querySelector('[data-authored-append]')).not.toBeNull();
        expect(authored.querySelector('.i-ignored')).toBeNull();
        expect(authored.querySelector('.i-ignored-end')).toBeNull();
        expect(authored.querySelector('.i-tabler-calendar')).toBeNull();
    });

    it('does not reinitialize x-is on stable accessories during DatePicker renders', async () => {
        const picker = mount(`
            <div x-is="date-picker" value="2026-08-12">
                <span slot="prepend" x-is="badge" data-stable-accessory>Ready</span>
            </div>
        `);
        await tick();
        const accessory = picker.querySelector('[data-stable-accessory]');
        const accessoryRuntime = HostRuntime.from(accessory);
        const accessoryComponent = accessoryRuntime.componentFor('badge');
        const configure = vi.spyOn(HostRuntime.prototype, 'configureComponent');

        HostRuntime.from(picker).componentFor('date-picker').requestRender();
        await tick();

        expect(configure).not.toHaveBeenCalled();
        expect(picker.querySelector('[data-stable-accessory]')).toBe(accessory);
        expect(HostRuntime.from(accessory)).toBe(accessoryRuntime);
        expect(accessoryRuntime.componentFor('badge')).toBe(accessoryComponent);
        configure.mockRestore();
    });

    it('opens from noninteractive accessories but preserves authored interactions', async () => {
        const picker = mount(`
            <div x-is="date-picker">
                <span slot="prepend" data-open-accessory>Open</span>
                <button slot="append" type="button" data-own-action>Action</button>
            </div>
        `);
        await tick();

        picker.querySelector('[data-open-accessory]').click();
        await tick();
        expect(Alpine.$data(picker).$datePicker.open).toBe(true);
        Alpine.$data(picker).$datePicker.close();
        await tick();

        picker.querySelector('[data-own-action]').click();
        await tick();
        expect(Alpine.$data(picker).$datePicker.open).toBe(false);
    });

    it('clears committed values, drafts, models, and native forms from a sibling action', async () => {
        const form = mount(`
            <form x-data="{ range: '2026-08-10/2026-08-16' }">
                <div x-is="date-picker" x-model="range" selection="range"
                    name="period" today="2026-08-04" clearable
                    clear-action:aria-label="Remove period"
                    clear-action:class="authored-clear"
                    clear-icon:class="authored-clear-icon"></div>
                <output x-text="range"></output>
            </form>
        `);
        await tick();
        const picker = form.querySelector('[data-isas-date-picker]');
        const events = [];
        picker.addEventListener('input', () => events.push('input'));
        picker.addEventListener('change', () => events.push('change'));
        picker.querySelector('[data-zag-day-trigger][data-value="2026-08-20"]').click();
        await tick();
        expect(Alpine.$data(picker).$datePicker.draft).toBe('2026-08-20');
        events.length = 0;

        const clear = picker.querySelector('[data-isas-date-picker-clear]');
        expect(clear).not.toBeNull();
        expect(clear.getAttribute('aria-label')).toBe('Remove period');
        expect(clear.classList).toContain('authored-clear');
        expect(clear.firstElementChild.classList).toContain('authored-clear-icon');
        clear.focus();
        clear.click();
        await tick();

        expect(picker.value).toBe('');
        expect(form.querySelector('output').textContent).toBe('');
        expect(new FormData(form).get('period')).toBe('');
        expect(Alpine.$data(picker).$datePicker.draft).toBe('');
        expect(events).toEqual(['input', 'change']);
        expect(picker.querySelector('[data-isas-date-picker-clear]')).toBeNull();
        expect(document.activeElement).toBe(
            picker.querySelector('[data-isas-date-picker-trigger]'),
        );
        expect(picker.querySelectorAll('[data-zag-day-trigger][data-selected]')).toHaveLength(0);
    });

    it('does not clear disabled or readonly DatePickers', async () => {
        const wrapper = mount(`
            <div>
                <div x-is="date-picker" value="2026-08-12" clearable disabled></div>
                <div x-is="date-picker" value="2026-08-13" clearable readonly></div>
            </div>
        `);
        await tick();

        for (const picker of wrapper.children) {
            const clear = picker.querySelector('[data-isas-date-picker-clear]');
            expect(clear.disabled).toBe(true);
            clear.click();
            expect(Alpine.$data(picker).$datePicker.clear()).toBe(false);
        }
        expect(wrapper.children[0].value).toBe('2026-08-12');
        expect(wrapper.children[1].value).toBe('2026-08-13');
    });

    it('reconciles DatePicker styles and stable accessories across Livewire-like morphs', async () => {
        const picker = mount(`
            <div x-is="date-picker" size="sm" color="primary" clearable
                value="2026-08-12" class="w-full">
                <span slot="prepend" x-is="badge" wire:key="date-kind">Start</span>
            </div>
        `);
        await tick();
        const prepend = picker.querySelector('[data-isas-date-picker-prepend] .badge');
        expect(picker.classList).toContain('w-full');
        expect(picker.querySelector('[data-isas-date-picker-trigger-shell]').classList)
            .toContain('w-full');

        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'date-picker');
        incoming.setAttribute('size', 'lg');
        incoming.setAttribute('color', 'success');
        incoming.setAttribute('variant', 'ghost');
        incoming.setAttribute('clearable', '');
        incoming.setAttribute('readonly', '');
        incoming.setAttribute('value', '2026-08-12');
        incoming.setAttribute('class', 'w-full');
        incoming.innerHTML = `
            <span slot="prepend" x-is="badge" wire:key="date-kind">Updated</span>
        `;

        expect(HostRuntime.from(picker).reconcileFrom(incoming)).toBe(true);
        await tick();
        const shell = picker.querySelector('[data-isas-date-picker-trigger-shell]');
        expect(shell.className).toContain('input-lg');
        expect(shell.className).toContain('input-success');
        expect(shell.className).toContain('input-ghost');
        expect(shell.className).not.toContain('input-sm');
        expect(shell.className).not.toContain('input-primary');
        expect(picker.querySelector('[data-isas-date-picker-prepend] .badge')).toBe(prepend);
        expect(prepend.textContent).toBe('Updated');
        expect(picker.querySelector('[data-isas-date-picker-clear]').disabled).toBe(true);
    });

    it('navigates the accessible day, month, and year views', async () => {
        const host = mount('<div x-is="calendar" today="2026-08-04"></div>');
        await tick();

        host.querySelector('[data-zag-action="view"]').click();
        await tick();
        expect(host.querySelectorAll('[data-zag-month-cell]')).toHaveLength(12);

        host.querySelector('[data-zag-action="view"]').click();
        await tick();
        expect(host.querySelectorAll('[data-zag-year-cell]')).toHaveLength(10);

        host.querySelector('[data-zag-action="next"]').click();
        await tick();
        expect(host.querySelectorAll('[data-zag-year-cell]')).toHaveLength(10);
    });

    it('keeps a range draft off the host until the end date is selected', async () => {
        const host = mount(`
            <div x-is="calendar" selection="range" today="2026-08-04"
                value="2026-08-01/2026-08-02"></div>
        `);
        await tick();
        host.querySelector('[data-zag-day-trigger][data-value="2026-08-10"]').click();
        await tick();

        expect(host.value).toBe('2026-08-01/2026-08-02');
        expect(Alpine.$data(host).$calendar.draft).toBe('2026-08-10');

        host.querySelector('[data-zag-day-trigger][data-value="2026-08-14"]').click();
        await tick();
        expect(host.value).toBe('2026-08-10/2026-08-14');
        expect(Alpine.$data(host).$calendar.draft).toBe('');
    });

    it('removes obsolete range state from preserved x-isas day roots', async () => {
        const host = mount(`
            <div x-is="calendar" selection="range" today="2026-08-04"
                value="2026-08-10/2026-08-16">
                <template slot="day">
                    <button x-as="tooltip" x-bind:tooltip="$day.label"
                        x-text="$day.number"></button>
                </template>
            </div>
        `);
        await tick();
        const selected = () => [...host.querySelectorAll(
            '[data-zag-day-trigger][data-selected]',
        )].map((element) => element.dataset.value);
        const inRange = () => [...host.querySelectorAll(
            '[data-zag-day-trigger][data-in-range]',
        )].map((element) => element.dataset.value);
        const click = async (value) => {
            host.querySelector(`[data-zag-day-trigger][data-value="${value}"]`).click();
            await tick();
        };

        await click('2026-08-05');
        expect(selected()).toEqual(['2026-08-05']);
        expect(inRange()).toEqual([]);
        await click('2026-08-09');
        expect(selected()).toEqual(['2026-08-05', '2026-08-09']);
        expect(inRange()).toEqual([
            '2026-08-05',
            '2026-08-06',
            '2026-08-07',
            '2026-08-08',
            '2026-08-09',
        ]);

        await click('2026-08-24');
        expect(selected()).toEqual(['2026-08-24']);
        expect(inRange()).toEqual([]);
        await click('2026-08-30');
        expect(selected()).toEqual(['2026-08-24', '2026-08-30']);
        expect(inRange()).toHaveLength(7);
        expect(host.value).toBe('2026-08-24/2026-08-30');
        expect(Alpine.$data(
            host.querySelector('[data-zag-day-trigger][data-value="2026-08-05"]'),
        ).$day.selected).toBe(false);
        expect(Alpine.$data(
            host.querySelector('[data-zag-day-trigger][data-value="2026-08-24"]'),
        ).$day.selected).toBe(true);
    });

    it('keeps only the latest single selection on preserved x-isas day roots', async () => {
        const host = mount(`
            <div x-is="calendar" today="2026-08-04">
                <template slot="day">
                    <button x-as="tooltip" x-bind:tooltip="$day.label"
                        x-text="$day.number"></button>
                </template>
            </div>
        `);
        await tick();

        for (const value of ['2026-08-05', '2026-08-09', '2026-08-24']) {
            host.querySelector(`[data-zag-day-trigger][data-value="${value}"]`).click();
            await tick();
            expect([...host.querySelectorAll('[data-zag-day-trigger][data-selected]')]
                .map((element) => element.dataset.value)).toEqual([value]);
        }

        expect(host.value).toBe('2026-08-24');
        expect(Alpine.$data(
            host.querySelector('[data-zag-day-trigger][data-value="2026-08-09"]'),
        ).$day.selected).toBe(false);
        expect(Alpine.$data(
            host.querySelector('[data-zag-day-trigger][data-value="2026-08-24"]'),
        ).$day.selected).toBe(true);
    });

    it('keeps Alpine range models unchanged until a two-month range is complete', async () => {
        const wrapper = mount(`
            <div x-data="{ range: '2026-08-10/2026-08-16' }">
                <div x-is="calendar" x-model="range" selection="range"
                    months="2" today="2026-08-04"></div>
                <output x-text="range"></output>
            </div>
        `);
        await tick();
        const host = wrapper.firstElementChild;
        host.querySelector('[data-zag-day-trigger][data-value="2026-08-20"]').click();
        await tick();
        expect(Alpine.$data(host).$calendar.draft).toBe('2026-08-20');
        expect(wrapper.querySelector('output').textContent).toBe('2026-08-10/2026-08-16');
        host.querySelector('[data-zag-day-trigger][data-value="2026-08-24"]').click();
        await tick();
        expect(host.value).toBe('2026-08-20/2026-08-24');
        expect(wrapper.querySelector('output').textContent).toBe('2026-08-20/2026-08-24');
    });

    it('uses exact day templates before the general template and exposes $day', async () => {
        const host = mount(`
            <div x-is="calendar" today="2026-08-04">
                <template slot="day"><button class="general" x-text="$day.number"></button></template>
                <template slot="day" date="2026-08-12"><button class="exact" x-text="$day.label"></button></template>
            </div>
        `);
        await tick();

        const exact = host.querySelector('[data-zag-day-trigger][data-value="2026-08-12"]');
        const general = host.querySelector('[data-zag-day-trigger][data-value="2026-08-11"]');
        expect(exact.classList).toContain('exact');
        expect(general.classList).toContain('general');
        expect(exact.textContent.trim()).not.toBe('');
        expect(Alpine.$data(exact).$day.value).toBe('2026-08-12');
    });

    it('rejects duplicate and malformed exact date templates', async () => {
        expect(() => mount(`
            <div x-is="calendar">
                <template slot="day" date="not-a-date"><button>Bad</button></template>
            </div>
        `)).toThrow(/must use YYYY-MM-DD/);
        Alpine.destroyTree(document.body);
        document.body.replaceChildren();

        expect(() => mount(`
            <div x-is="calendar">
                <template slot="day" date="2026-08-12"><button>A</button></template>
                <template slot="day" date="2026-08-12"><button>B</button></template>
            </div>
        `)).toThrow(/duplicate day template date/);
    });

    it('applies built-in and explicit presets through the DatePicker owner', async () => {
        const host = mount(`
            <div x-is="date-picker" selection="range" today="2026-08-04">
                <button x-as="date-preset" preset="last-3-days">Last three days</button>
                <button x-as="date-preset" value="2026-07-01/2026-07-07">Custom</button>
            </div>
        `);
        await tick();

        host.querySelector('[preset="last-3-days"]').click();
        await tick();
        expect(host.value).toBe('2026-08-02/2026-08-04');

        host.querySelector('[value="2026-07-01/2026-07-07"]').click();
        await tick();
        expect(host.value).toBe('2026-07-01/2026-07-07');
    });

    it('resets to its authored default and forwards constraint validation', async () => {
        const form = mount(`
            <form>
                <div x-is="calendar" name="date" required min="2026-08-01"
                    max="2026-08-31" today="2026-08-04" value="2026-08-12"></div>
            </form>
        `);
        await tick();
        const host = form.firstElementChild;
        HostRuntime.from(host).componentFor('calendar').commitValue('');
        await tick();
        expect(host.querySelector('[data-isas-calendar-control]').validity.valueMissing).toBe(true);

        form.reset();
        await tick();
        expect(host.value).toBe('2026-08-12');
        expect(new FormData(form).get('date')).toBe('2026-08-12');
    });
});
