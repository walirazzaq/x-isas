import { describe, expect, it } from 'vitest';

// Entry modules are intentionally loaded in public-consumer order. Keeping
// transformation outside the timed assertion avoids coupling this contract to
// worker contention when the complete suite runs in parallel.
const core = await import('../src/core.js');
const neutralAdapterEntries = core.Isas.adapters.entries();
const neutralOptionalComponents = {
    calendar: core.Isas.components.has('calendar'),
    datePicker: core.Isas.components.has('date-picker'),
    fileUpload: core.Isas.components.has('file-upload'),
};
const daisyUI = await import('../src/adapters/daisyui/index.js');
const root = await import('../src/index.js');
const rootAdapterEntries = root.Isas.adapters.entries();
const calendar = await import('../src/calendar.js');
const upload = await import('../src/upload.js');

describe('package entry points', () => {
    it('keeps core neutral and composes DaisyUI adapters explicitly or by default', () => {
        expect(core.Isas.components.has('button')).toBe(true);
        expect(neutralAdapterEntries).toEqual([]);
        expect(core.TargetComponent).toBeTypeOf('function');
        expect(core.TargetController).toBeTypeOf('function');
        expect(core.targetRegistry).toBeTypeOf('object');
        expect(core.Alert).toBeTypeOf('function');
        expect(core.Chat).toBeTypeOf('function');
        expect(core.Dock).toBeTypeOf('function');
        expect(core.Otp).toBeTypeOf('function');
        expect(core.List).toBeTypeOf('function');
        expect(core.Progress).toBeTypeOf('function');
        expect(core.RadialProgress).toBeTypeOf('function');
        expect(core.SelectField).toBeTypeOf('function');
        expect(core.Steps).toBeTypeOf('function');
        expect(core.Stats).toBeTypeOf('function');
        expect(core.Tabs).toBeTypeOf('function');
        expect(core.TabPanels).toBeTypeOf('function');
        expect(core.TabContent).toBeTypeOf('function');
        expect(core.Timeline).toBeTypeOf('function');
        expect(core.Isas.components.has('progress')).toBe(true);
        expect(core.Isas.components.has('chat')).toBe(true);
        expect(core.Isas.components.has('radial-progress')).toBe(true);
        expect(core.Isas.components.has('list')).toBe(true);
        expect(core.Isas.components.has('select-field')).toBe(true);
        expect(core.Isas.components.has('steps')).toBe(true);
        expect(core.Isas.components.has('stats')).toBe(true);
        expect(core.Isas.components.has('tabs')).toBe(true);
        expect(core.Isas.components.has('tab-panels')).toBe(true);
        expect(core.Isas.components.has('tab-content')).toBe(true);
        expect(core.Isas.components.has('dock')).toBe(true);
        expect(core.Isas.components.has('timeline')).toBe(true);
        expect(core.Isas.components.has('timeline-item')).toBe(false);
        expect(neutralOptionalComponents.calendar).toBe(false);
        expect(neutralOptionalComponents.datePicker).toBe(false);
        expect(neutralOptionalComponents.fileUpload).toBe(false);
        expect(core.Isas.components.has('dock-item')).toBe(false);
        expect(core.Isas.components.has('step')).toBe(false);
        expect(core.Isas.components.has('stat')).toBe(false);
        expect(core.Isas.components.has('list-item')).toBe(false);
        expect(core.Isas.components.has('redial-progress')).toBe(false);
        expect(core.TARGET_READY_EVENT).toBeUndefined();
        expect(core.TARGET_UNAVAILABLE_EVENT).toBeUndefined();
        expect(core.Isas.processors).toBeUndefined();
        expect(core.ProcessorRegistry).toBeUndefined();

        const registry = new core.AdapterRegistry();

        expect(daisyUI.installDaisyUIAdapters(registry)).toBe(registry);
        expect(daisyUI.installDaisyUIAdapters(registry)).toBe(registry);
        expect(registry.entries()).toEqual(Object.entries(daisyUI.daisyUIAdapters));

        const selected = new core.AdapterRegistry();
        selected
            .register('button', daisyUI.buttonAdapter)
            .register('otp', daisyUI.otpAdapter);
        expect(selected.entries()).toEqual([
            ['button', daisyUI.buttonAdapter],
            ['otp', daisyUI.otpAdapter],
        ]);

        expect(root.Alert).toBe(core.Alert);
        expect(root.Chat).toBe(core.Chat);
        expect(root.Dock).toBe(core.Dock);
        expect(root.Otp).toBe(core.Otp);
        expect(root.List).toBe(core.List);
        expect(root.Progress).toBe(core.Progress);
        expect(root.RadialProgress).toBe(core.RadialProgress);
        expect(root.SelectField).toBe(core.SelectField);
        expect(root.Steps).toBe(core.Steps);
        expect(root.Stats).toBe(core.Stats);
        expect(root.Tabs).toBe(core.Tabs);
        expect(root.TabPanels).toBe(core.TabPanels);
        expect(root.TabContent).toBe(core.TabContent);
        expect(root.Timeline).toBe(core.Timeline);
        expect(root.Calendar).toBeUndefined();
        expect(root.FileUpload).toBeUndefined();
        expect(root.otpAdapter).toBe(daisyUI.otpAdapter);
        expect(root.listAdapter).toBe(daisyUI.listAdapter);
        expect(root.progressAdapter).toBe(daisyUI.progressAdapter);
        expect(root.radialProgressAdapter).toBe(daisyUI.radialProgressAdapter);
        expect(root.selectFieldAdapter).toBe(daisyUI.selectFieldAdapter);
        expect(root.alertAdapter).toBe(daisyUI.alertAdapter);
        expect(root.chatAdapter).toBe(daisyUI.chatAdapter);
        expect(root.stepsAdapter).toBe(daisyUI.stepsAdapter);
        expect(root.statsAdapter).toBe(daisyUI.statsAdapter);
        expect(root.tabsAdapter).toBe(daisyUI.tabsAdapter);
        expect(root.dockAdapter).toBe(daisyUI.dockAdapter);
        expect(root.timelineAdapter).toBe(daisyUI.timelineAdapter);
        expect(rootAdapterEntries).toEqual(Object.entries(daisyUI.daisyUIAdapters));

        expect(calendar.Calendar).toBeTypeOf('function');
        expect(calendar.DatePicker).toBeTypeOf('function');
        expect(calendar.DatePreset).toBeTypeOf('function');
        expect(calendar.Isas.components.has('calendar')).toBe(true);
        expect(calendar.Isas.components.has('date-picker')).toBe(true);

        expect(upload.FileUpload).toBeTypeOf('function');
        expect(upload.FileUploadDriver).toBeTypeOf('function');
        expect(upload.uploadTransports).toBeTypeOf('object');
        expect(upload.Isas.components.has('file-upload')).toBe(true);
        expect(upload.Isas.adapters.get('file-upload')).toBe(upload.fileUploadAdapter);
    });
});
