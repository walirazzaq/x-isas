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
    HostRuntime,
    Isas,
    Option,
    optionAdapter,
    Select,
    SelectControl,
    selectAdapter,
} from '../src/index.js';

const tick = async () => {
    await Promise.resolve();
    await Alpine.nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
};

function mount(html) {
    document.body.innerHTML = html;
    Alpine.initTree(document.body);
    return document.body.firstElementChild;
}

function selectState(element) {
    return Alpine.$data(element).$select;
}

function optionState(element) {
    return Alpine.$data(element).$option;
}

beforeAll(() => {
    globalThis.Alpine = Alpine;
    Alpine.plugin(morph);
    Alpine.plugin(isas);
});

afterEach(async () => {
    Alpine.destroyTree(document.body);
    document.body.replaceChildren();
    vi.restoreAllMocks();
    await tick();
});

afterAll(() => {
    delete globalThis.Alpine;
});

describe('select and option registration', () => {
    it('exports styled components and DaisyUI adapter hooks', () => {
        expect(Isas.components.get('select')).toBe(Select);
        expect(Isas.components.get('select-control')).toBe(SelectControl);
        expect(Isas.components.get('option')).toBe(Option);
        expect(Isas.components.get('option-group')).toBeNull();
        expect(Isas.adapters.get('select')).toBe(selectAdapter);
        expect(Isas.adapters.get('option')).toBe(optionAdapter);
        expect(Isas.adapters.get('option-group')).toBeNull();
    });

    it('finds the nearest select through wrappers and respects nested boundaries', async () => {
        const root = mount(`
            <div x-as="select" id="outer">
                <section>
                    <button id="outer-option" x-as="option" value="outer">Outer</button>
                    <div x-as="select" id="inner">
                        <span>
                            <button id="inner-option" x-as="option" value="inner">Inner</button>
                        </span>
                    </div>
                </section>
            </div>
        `);
        await tick();

        const inner = root.querySelector('#inner');
        expect(selectState(root).options.map((option) => option.value)).toEqual(['outer']);
        expect(selectState(inner).options.map((option) => option.value)).toEqual(['inner']);
        expect(optionState(root.querySelector('#outer-option')).attached).toBe(true);
        expect(optionState(root.querySelector('#inner-option')).attached).toBe(true);
    });

    it('keeps overlay state and actions out of the headless namespace', async () => {
        const host = mount(`
            <div x-as="select">
                <button x-as="option" value="alpha">Alpha</button>
            </div>
        `);
        await tick();

        const select = selectState(host);
        expect('open' in select).toBe(false);
        expect('presentation' in select).toBe(false);
        expect('toggleOverlay' in select).toBe(false);
        expect(host.querySelector('dialog[x-is="overlay"]')).toBeNull();
        expect(select.toggle('alpha')).toBe(true);
        expect(select.value).toBe('alpha');
    });

    it('registers x-for options after their bound value and label resolve', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const host = mount(`
            <div
                x-data="{ chosen: 'review', choices: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'review', label: 'In review' },
                    { value: 'released', label: 'Released' },
                ] }"
                x-as="select"
                x-model="chosen"
            >
                <template x-for="choice in choices" :key="choice.value">
                    <button
                        x-is="button"
                        x-as="option"
                        :value="choice.value"
                        :label="choice.label"
                        @click="$option.select()"
                        x-text="choice.label"
                    ></button>
                </template>
            </div>
        `);
        await tick();
        await tick();

        expect(selectState(host).options.map(({ value, label }) => [value, label])).toEqual([
            ['draft', 'Draft'],
            ['review', 'In review'],
            ['released', 'Released'],
        ]);
        expect(selectState(host).selectedOptions[0].label).toBe('In review');
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("duplicate value ''"));

        host.querySelector('[value="released"]').click();
        await tick();
        expect(selectState(host).value).toBe('released');
        expect(Alpine.$data(host).chosen).toBe('released');
    });

    it('reports an option without an ancestor select and leaves it inactive', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const option = mount('<button x-as="option" value="orphan">Orphan</button>');
        await tick();

        expect(error).toHaveBeenCalledWith(
            "Component 'option' requires an ancestor component 'select'.",
        );
        expect(optionState(option).attached).toBe(false);
        expect(optionState(option).select()).toBe(false);
    });

    it('reparents an option between select owners', async () => {
        const root = mount(`
            <div>
                <div id="first" x-as="select">
                    <button id="moving" x-as="option" value="moving">Moving</button>
                </div>
                <div id="second" x-as="select"></div>
            </div>
        `);
        await tick();

        const first = root.querySelector('#first');
        const second = root.querySelector('#second');
        const moving = root.querySelector('#moving');
        expect(selectState(first).length).toBe(1);

        second.append(moving);
        await tick();
        await tick();

        expect(selectState(first).length).toBe(0);
        expect(selectState(second).options.map((option) => option.value)).toEqual(['moving']);
    });

    it('rejects duplicate values and promotes the remaining candidate', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const host = mount(`
            <div x-as="select">
                <button id="first" x-as="option" value="same">First</button>
                <button id="second" x-as="option" value="same">Second</button>
            </div>
        `);
        await tick();

        expect(selectState(host).length).toBe(1);
        expect(selectState(host).options[0].label).toBe('First');
        expect(optionState(host.querySelector('#second')).attached).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("duplicate value 'same'"));

        host.querySelector('#first').remove();
        await tick();
        await tick();

        expect(selectState(host).length).toBe(1);
        expect(selectState(host).options[0].label).toBe('Second');
        expect(optionState(host.querySelector('#second')).attached).toBe(true);
    });
});

describe('native form participation', () => {
    it('generates a required native control for styled Select and submits its value', async () => {
        const form = mount(`
            <form>
                <div id="owner" x-is="select" name="owner" required label="Owner">
                    <div x-is="option" value="ada" label="Ada"></div>
                    <div x-is="option" value="grace" label="Grace"></div>
                </div>
            </form>
        `);
        await tick();
        await tick();

        const host = form.querySelector('#owner');
        const state = selectState(host);
        const control = host.querySelector('[data-isas-select-control]');
        const trigger = host.querySelector('[data-isas-select-trigger]');

        expect(control).toBeInstanceOf(HTMLSelectElement);
        expect(control.hidden).toBe(true);
        expect(control.name).toBe('owner');
        expect(control.required).toBe(true);
        expect(control.options.length).toBe(2);
        expect(control.selectedIndex).toBe(-1);
        expect(state.formControl).toBe(control);
        expect(state.valid).toBe(false);
        expect(state.checkValidity()).toBe(false);
        await tick();
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(host.querySelector('[data-isas-select-error]').hidden).toBe(false);

        expect(state.select('grace')).toBe(true);
        await tick();
        expect(control.value).toBe('grace');
        expect(state.valid).toBe(true);
        expect(trigger.hasAttribute('aria-invalid')).toBe(false);
        expect(Object.fromEntries(new FormData(form))).toEqual({ owner: 'grace' });
    });

    it('serializes multiple values in option order and retains selected unknown values', async () => {
        const form = mount(`
            <form>
                <div
                    id="members"
                    x-data="{ chosen: ['remote', 'c', 'a'] }"
                    x-as="select"
                    x-model="chosen"
                    multiple
                >
                    <select x-as="select-control" name="members"></select>
                    <button x-as="option" value="a">A</button>
                    <button x-as="option" value="b">B</button>
                    <button x-as="option" value="c">C</button>
                </div>
            </form>
        `);
        await tick();
        await tick();

        const host = form.querySelector('#members');
        const control = host.querySelector('select');
        expect([...control.options].map((option) => option.value)).toEqual([
            'a', 'b', 'c', 'remote',
        ]);
        expect([...control.selectedOptions].map((option) => option.value)).toEqual([
            'a', 'c', 'remote',
        ]);
    });

    it('synchronizes an authored headless control back into its model', async () => {
        const form = mount(`
            <form>
                <div id="status" x-data="{ chosen: 'draft' }" x-as="select" x-model="chosen">
                    <select x-as="select-control" name="status"></select>
                    <button x-as="option" value="draft">Draft</button>
                    <button x-as="option" value="released">Released</button>
                </div>
            </form>
        `);
        await tick();
        await tick();

        const host = form.querySelector('#status');
        const control = host.querySelector('select');
        control.value = 'released';
        control.dispatchEvent(new Event('change', { bubbles: true }));
        await tick();

        expect(selectState(host).value).toBe('released');
        expect(Alpine.$data(host).chosen).toBe('released');
    });

    it('restores the initialized value and model when the form resets', async () => {
        const form = mount(`
            <form>
                <div id="status" x-data="{ chosen: 'draft' }" x-is="select"
                    x-model="chosen" name="status">
                    <div x-is="option" value="draft">Draft</div>
                    <div x-is="option" value="released">Released</div>
                </div>
                <button type="reset">Reset</button>
            </form>
        `);
        await tick();
        await tick();

        const host = form.querySelector('#status');
        const state = selectState(host);
        state.select('released');
        await tick();
        expect(Alpine.$data(host).chosen).toBe('released');

        form.reset();
        await tick();
        expect(state.value).toBe('draft');
        expect(Alpine.$data(host).chosen).toBe('draft');
        expect(new FormData(form).get('status')).toBe('draft');
    });

    it('uses a native Select host directly without rewriting selected defaults', async () => {
        const form = mount(`
            <form>
                <select id="native" x-as="select" name="native" required>
                    <option x-as="option" value="a" selected>A</option>
                    <option x-as="option" value="b">B</option>
                </select>
            </form>
        `);
        await tick();

        const control = form.querySelector('#native');
        const state = selectState(control);
        state.select('b');
        await tick();

        expect(control.value).toBe('b');
        expect(control.options[0].hasAttribute('selected')).toBe(true);
        expect(control.options[1].hasAttribute('selected')).toBe(false);
        form.reset();
        await tick();
        expect(state.value).toBe('a');
    });

    it('matches Input custom validity ownership and exposes the validity API', async () => {
        const form = mount(`
            <form>
                <div id="field" x-is="select" name="field" error="Server rejected this">
                    <div x-is="option" value="a">A</div>
                </div>
            </form>
        `);
        await tick();
        await tick();

        const host = form.querySelector('#field');
        const state = selectState(host);
        const control = state.formControl;
        expect(state.validationMessage).toBe('Server rejected this');
        expect(state.valid).toBe(false);
        expect(state.invalid).toBe(true);
        expect(state.willValidate).toBe(true);
        expect(state.form).toBe(form);

        control.setCustomValidity('External');
        host.removeAttribute('error');
        await tick();
        expect(control.validationMessage).toBe('External');

        expect(state.setCustomValidity('')).toBe(true);
        expect(state.valid).toBe(true);
    });

    it('applies native overrides and keeps boolean error presentation-only', async () => {
        const form = mount(`
            <form>
                <div id="override-field" x-is="select" name="default" required disabled error
                    native:name="overridden" native:required="false">
                    <div x-is="option" value="a" selected>A</div>
                </div>
            </form>
        `);
        await tick();
        await tick();

        const host = form.querySelector('#override-field');
        const state = selectState(host);
        const control = state.formControl;
        expect(control.name).toBe('overridden');
        expect(control.required).toBe(false);
        expect(control.disabled).toBe(true);
        expect(state.invalid).toBe(true);
        expect(control.validationMessage).toBe('');
    });

    it('keeps generated control constraints synchronized with host mutations', async () => {
        const form = mount(`
            <form>
                <div id="dynamic-control-owner" x-is="select" name="owner" required>
                    <div x-is="option" value="ada">Ada</div>
                </div>
            </form>
        `);
        await tick();

        const host = form.querySelector('#dynamic-control-owner');
        const control = host.querySelector('[data-isas-select-control]');
        expect(control.disabled).toBe(false);
        expect(control.name).toBe('owner');

        host.setAttribute('disabled', '');
        host.setAttribute('name', 'reviewer');
        host.setAttribute('native:autocomplete', 'organization-title');
        await tick();
        await tick();

        expect(host.querySelector('[data-isas-select-control]')).toBe(control);
        expect([...control.options].map((option) => option.value)).toEqual(['ada']);
        expect(control.disabled).toBe(true);
        expect(control.name).toBe('reviewer');
        expect(control.getAttribute('autocomplete')).toBe('organization-title');

        host.removeAttribute('disabled');
        host.removeAttribute('native:autocomplete');
        await tick();
        await tick();

        expect(host.querySelector('[data-isas-select-control]')).toBe(control);
        expect([...control.options].map((option) => option.value)).toEqual(['ada']);
        expect(control.disabled).toBe(false);
        expect(control.hasAttribute('autocomplete')).toBe(false);
    });

    it('rejects invalid select-control hosts, contents, owners, and duplicates', async () => {
        const wrongHost = new SelectControl();
        wrongHost.el = document.createElement('div');
        expect(() => wrongHost.mount()).toThrow('requires a native <select> host');

        const authoredOptions = new SelectControl();
        authoredOptions.el = document.createElement('select');
        authoredOptions.el.append(document.createElement('option'));
        expect(() => authoredOptions.mount()).toThrow('owns its native options');

        const orphan = new SelectControl();
        orphan.el = document.createElement('select');
        orphan.owner = () => null;
        expect(() => orphan.mount()).toThrow("requires an ancestor component 'select'");

        const host = mount(`
            <div x-as="select">
                <select x-as="select-control"></select>
                <button x-as="option" value="a">A</button>
            </div>
        `);
        await tick();
        const component = HostRuntime.from(host).componentFor('select');
        expect(() => component.registerFormControl({
            el: document.createElement('select'),
        })).toThrow('accepts only one native form control');
    });

});

describe('selection behavior and durable option records', () => {
    it('uses selected attributes without auto-selecting an otherwise empty single select', async () => {
        const empty = mount(`
            <div x-as="select">
                <button x-as="option" value="a">A</button>
                <button x-as="option" value="b">B</button>
            </div>
        `);
        await tick();
        expect(selectState(empty).value).toBe('');
        expect(selectState(empty).selectedIndex).toBe(-1);

        Alpine.destroyTree(empty);
        document.body.replaceChildren();

        const selected = mount(`
            <div x-as="select">
                <button x-as="option" value="a" selected>A</button>
                <button x-as="option" value="b" selected>B</button>
            </div>
        `);
        await tick();

        expect(selectState(selected).value).toBe('b');
        expect(selectState(selected).selectedIndex).toBe(1);
    });

    it('preserves multi-select model order instead of DOM order', async () => {
        const host = mount(`
            <div x-data="{ chosen: ['c', 'a'] }" x-as="select" x-model="chosen" multiple>
                <button x-as="option" value="a">A</button>
                <button x-as="option" value="b">B</button>
                <button x-as="option" value="c">C</button>
            </div>
        `);
        await tick();

        const state = selectState(host);
        expect(state.options.map((option) => option.value)).toEqual(['a', 'b', 'c']);
        expect(state.values).toEqual(['c', 'a']);
        expect(state.selectedOptions.map((option) => option.value)).toEqual(['c', 'a']);
    });

    it('retains selection metadata and custom HTML after a selected option is removed', async () => {
        const host = mount(`
            <div x-as="select" multiple>
                <button id="kept" x-as="option" value="kept" label="Kept" selected>
                    Visible
                    <template slot="selection">
                        <strong class="chip">Selected chip</strong>
                    </template>
                </button>
            </div>
        `);
        await tick();

        const state = selectState(host);
        const selected = state.selectedOptions[0];
        expect(selected.selection).toContain('Selected chip');
        expect(selected.attached).toBe(true);

        host.querySelector('#kept').remove();
        await tick();
        await tick();

        expect(state.value).toEqual(['kept']);
        expect(state.options).toEqual([]);
        expect(state.selectedOptions[0]).toBe(selected);
        expect(selected.el).toBeNull();
        expect(selected.attached).toBe(false);
        expect(selected.label).toBe('Kept');
        expect(selected.selection).toContain('Selected chip');

        expect(selected.unselect()).toBe(true);
        expect(state.selectedOptions).toEqual([]);
        expect(state.value).toEqual([]);
    });

    it('renders retained selection HTML inside an x-for option scope', async () => {
        const host = mount(`
            <div x-as="select" multiple>
                <button x-as="option" value="a" label="Alpha" selected>
                    Alpha
                    <template slot="selection">
                        <strong class="selected-label" x-text="$option.label"></strong>
                    </template>
                </button>
                <template x-for="$option in $select.selectedOptions" :key="$option.value">
                    <span class="selected-output" x-html="$option.selection"></span>
                </template>
            </div>
        `);
        await tick();
        await tick();

        expect(host.querySelector('.selected-output .selected-label').textContent)
            .toBe('Alpha');
    });

    it('does not reconcile options for presentation-only descendant changes', async () => {
        const host = mount(`
            <div x-as="select" multiple>
                <button x-as="option" value="a" selected>A</button>
            </div>
        `);
        await tick();

        const component = HostRuntime.from(host).componentFor('select');
        const state = selectState(host);
        const options = state.options;
        const selectedOptions = state.selectedOptions;

        component.store.reconcile();
        expect(state.options).toBe(options);
        expect(state.selectedOptions).toBe(selectedOptions);

        const option = component.store.activeOptions()[0];
        const reconnect = vi.spyOn(option, 'connectOwner');
        const output = document.createElement('span');
        output.setAttribute('x-is', 'badge');
        output.textContent = 'Selection';
        host.append(output);
        Alpine.initTree(output);
        await tick();

        expect(reconnect).not.toHaveBeenCalled();
        expect(state.options).toBe(options);
        expect(state.selectedOptions).toBe(selectedOptions);
    });

    it('retains unknown model values and hydrates them when their option appears', async () => {
        const host = mount(`
            <div x-data="{ chosen: ['remote'] }" x-as="select" x-model="chosen" multiple></div>
        `);
        await tick();

        const state = selectState(host);
        const proxy = state.selectedOptions[0];
        expect(proxy.value).toBe('remote');
        expect(proxy.label).toBe('remote');
        expect(proxy.selection).toBe('remote');
        expect(proxy.attached).toBe(false);

        host.insertAdjacentHTML('beforeend', `
            <button x-as="option" value="remote" label="Remote user">
                <template slot="selection"><em>Remote chip</em></template>
            </button>
        `);
        Alpine.initTree(host.lastElementChild);
        await tick();
        await tick();

        expect(state.selectedOptions[0]).toBe(proxy);
        expect(proxy.attached).toBe(true);
        expect(proxy.label).toBe('Remote user');
        expect(proxy.selection).toContain('Remote chip');
    });

    it('updates selected identity and metadata when option attributes change', async () => {
        const host = mount(`
            <div x-as="select">
                <button id="option" x-as="option" value="before" label="Before" selected></button>
            </div>
        `);
        await tick();

        const option = host.querySelector('#option');
        option.setAttribute('value', 'after');
        option.setAttribute('label', 'After');
        await tick();

        expect(selectState(host).value).toBe('after');
        expect(selectState(host).selectedOptions[0].label).toBe('After');
        expect(optionState(option).value).toBe('after');
        expect(optionState(option).label).toBe('After');
    });

    it('keeps a bound selection while source reconciliation refreshes option metadata', async () => {
        const host = mount(`
            <div x-data="{ chosen: 'b' }" x-as="select" x-model="chosen">
                <button x-as="option" value="a">A</button>
                <button x-as="option" value="b" label="Before">B</button>
            </div>
        `);
        await tick();

        const incoming = document.createElement('div');
        incoming.setAttribute('x-data', "{ chosen: 'b' }");
        incoming.setAttribute('x-as', 'select');
        incoming.setAttribute('x-model', 'chosen');
        incoming.innerHTML = `
            <button x-as="option" value="a">A</button>
            <button x-as="option" value="b" label="After">B</button>
        `;

        expect(HostRuntime.from(host).reconcileFrom(incoming)).toBe(true);
        await tick();

        expect(selectState(host).value).toBe('b');
        expect(selectState(host).selectedOptions[0].label).toBe('After');
    });

    it('keeps model-bound selection authoritative over reflected selected mutations', async () => {
        const host = mount(`
            <div x-data="{ chosen: ['a', 'b'] }" x-as="select" x-model="chosen" multiple>
                <button id="a" x-as="option" value="a">A</button>
                <button id="b" x-as="option" value="b">B</button>
            </div>
        `);
        await tick();

        const a = host.querySelector('#a');
        expect(a.hasAttribute('selected')).toBe(true);

        a.removeAttribute('selected');
        await tick();

        expect(selectState(host).values).toEqual(['a', 'b']);
        expect(Alpine.$data(host).chosen).toEqual(['a', 'b']);
        expect(a.hasAttribute('selected')).toBe(true);
    });

    it('reacts to external selected and disabled attribute changes', async () => {
        const host = mount(`
            <div x-as="select">
                <button id="option" x-as="option" value="a">Alpha</button>
            </div>
        `);
        await tick();

        const element = host.querySelector('#option');
        const option = optionState(element);
        element.setAttribute('selected', '');
        element.setAttribute('disabled', '');
        await tick();

        expect(selectState(host).value).toBe('a');
        expect(option.selected).toBe(true);
        expect(option.disabled).toBe(true);

        element.removeAttribute('selected');
        element.removeAttribute('disabled');
        await tick();
        expect(selectState(host).value).toBe('');
        expect(option.selected).toBe(false);
        expect(option.disabled).toBe(false);
    });

    it('blocks option interactions when disabled while the select value setter remains authoritative', async () => {
        const host = mount(`
            <div x-as="select">
                <button id="disabled" x-as="option" value="locked" disabled>Locked</button>
            </div>
        `);
        await tick();

        const state = selectState(host);
        const option = optionState(host.querySelector('#disabled'));
        expect(option.select()).toBe(false);
        expect(state.value).toBe('');

        state.value = 'locked';
        await tick();
        expect(state.value).toBe('locked');
        expect(option.selected).toBe(true);
        expect(option.unselect()).toBe(false);

        expect(option.enable()).toBe(true);
        expect(option.unselect()).toBe(true);
        expect(state.value).toBe('');
    });
});

describe('model binding and public selection API', () => {
    it('reactively exposes initial and changed selection to option bindings', async () => {
        const host = mount(`
            <div x-data="{ chosen: 'b' }" x-as="select" x-model="chosen">
                <span id="selected-value" x-text="$select.value"></span>
                <span id="selected-index" :data-value="$select.selectedIndex"></span>
                <span
                    id="a-is-selected"
                    :data-value="$select.isSelected('a') ? 'yes' : 'no'"
                ></span>
                <button
                    id="a"
                    x-as="option"
                    value="a"
                    :class="{ 'is-selected': $option.selected }"
                >
                    A
                    <span class="selected-icon" x-show="$option.selected"></span>
                    <span class="unselected-icon" x-show="!$option.selected"></span>
                </button>
                <button
                    id="b"
                    x-as="option"
                    value="b"
                    :class="{ 'is-selected': $option.selected }"
                >
                    B
                    <span class="selected-icon" x-show="$option.selected"></span>
                    <span class="unselected-icon" x-show="!$option.selected"></span>
                </button>
            </div>
        `);
        await tick();

        const a = host.querySelector('#a');
        const b = host.querySelector('#b');
        expect(a.classList.contains('is-selected')).toBe(false);
        expect(b.classList.contains('is-selected')).toBe(true);
        expect(a.querySelector('.selected-icon').style.display).toBe('none');
        expect(a.querySelector('.unselected-icon').style.display).not.toBe('none');
        expect(b.querySelector('.selected-icon').style.display).not.toBe('none');
        expect(b.querySelector('.unselected-icon').style.display).toBe('none');
        expect(host.querySelector('#selected-value').textContent).toBe('b');
        expect(host.querySelector('#selected-index').dataset.value).toBe('1');
        expect(host.querySelector('#a-is-selected').dataset.value).toBe('no');

        expect(optionState(a).select()).toBe(true);
        await tick();

        expect(a.classList.contains('is-selected')).toBe(true);
        expect(b.classList.contains('is-selected')).toBe(false);
        expect(a.querySelector('.selected-icon').style.display).not.toBe('none');
        expect(a.querySelector('.unselected-icon').style.display).toBe('none');
        expect(b.querySelector('.selected-icon').style.display).toBe('none');
        expect(b.querySelector('.unselected-icon').style.display).not.toBe('none');
        expect(host.querySelector('#selected-value').textContent).toBe('a');
        expect(host.querySelector('#selected-index').dataset.value).toBe('0');
        expect(host.querySelector('#a-is-selected').dataset.value).toBe('yes');
    });

    it('synchronizes scalar x-model changes in both directions', async () => {
        const host = mount(`
            <div x-data="{ chosen: 'b' }" x-as="select" x-model="chosen">
                <button x-as="option" value="a" selected>A</button>
                <button x-as="option" value="b">B</button>
            </div>
        `);
        await tick();

        const data = Alpine.$data(host);
        const state = data.$select;
        expect(state.value).toBe('b');
        expect(host.value).toBe('b');

        const events = [];
        host.addEventListener('input', () => events.push('input'));
        host.addEventListener('change', () => events.push('change'));
        expect(state.select('a')).toBe(true);
        await tick();

        expect(data.chosen).toBe('a');
        expect(state.value).toBe('a');
        expect(events).toEqual(['input', 'change']);

        data.chosen = 'b';
        await tick();
        expect(state.value).toBe('b');
        expect(host.value).toBe('b');
    });

    it('synchronizes array x-model values and supports the complete selection API', async () => {
        const host = mount(`
            <div x-data="{ chosen: [] }" x-as="select" x-model="chosen" multiple>
                <button x-as="option" value="a">A</button>
                <button x-as="option" value="b">B</button>
                <button x-as="option" value="c" disabled>C</button>
            </div>
        `);
        await tick();

        const data = Alpine.$data(host);
        const state = data.$select;
        expect(state.select('b')).toBe(true);
        expect(state.toggle('a')).toBe(true);
        await tick();
        expect(data.chosen).toEqual(['b', 'a']);
        expect(state.selectedValues()).toEqual(['b', 'a']);
        expect(state.isSelected('a')).toBe(true);
        expect(state.option('a').label).toBe('A');
        expect(state.item(1).value).toBe('b');
        expect(state.length).toBe(3);

        expect(state.unselect('b')).toBe(true);
        expect(state.selectAll()).toBe(true);
        await tick();
        expect(data.chosen).toEqual(['a', 'b']);

        expect(state.unselectAll()).toBe(true);
        await tick();
        expect(data.chosen).toEqual([]);
    });

    it('collapses multiple selection to its first model-ordered value', async () => {
        const host = mount(`
            <div x-data="{ chosen: ['b', 'a'] }" x-as="select" x-model="chosen" multiple>
                <button x-as="option" value="a">A</button>
                <button x-as="option" value="b">B</button>
            </div>
        `);
        await tick();

        host.removeAttribute('multiple');
        await tick();
        await tick();

        expect(selectState(host).multiple).toBe(false);
        expect(selectState(host).value).toBe('b');
        expect(Alpine.$data(host).chosen).toBe('b');
    });
});

describe('headless search contract', () => {
    it('exposes query matching and emits search without changing presentation', async () => {
        const host = mount(`
            <div x-as="select">
                <button id="alice" x-as="option" value="1" label="Alice"></button>
                <button id="bob" x-as="option" value="bob-id" label="Bob"></button>
            </div>
        `);
        await tick();

        const events = [];
        host.addEventListener('search', (event) => events.push(event.detail));
        const select = selectState(host);
        const alice = optionState(host.querySelector('#alice'));
        const bob = optionState(host.querySelector('#bob'));

        select.query = 'ALI';
        await tick();
        expect(select.query).toBe('ALI');
        expect(alice.matchesQuery).toBe(true);
        expect(bob.matchesQuery).toBe(false);
        expect(bob.matches('bob-id')).toBe(true);
        expect(host.querySelector('#alice').hasAttribute('hidden')).toBe(false);
        expect(host.querySelector('#bob').hasAttribute('hidden')).toBe(false);
        expect(host.querySelector('#alice').getAttribute('style')).toBeNull();
        expect(host.querySelector('#bob').getAttribute('class')).toBeNull();
        expect(events).toEqual([{ query: 'ALI' }]);

        select.clearSearch();
        await tick();
        expect(alice.matchesQuery).toBe(true);
        expect(bob.matchesQuery).toBe(true);
        expect(events.at(-1)).toEqual({ query: '' });

        select.clearSearch();
        await tick();
        expect(events).toHaveLength(2);
    });
});

describe('styled structural rendering', () => {
    it('projects one stable options wrapper without replacing it or its children', async () => {
        document.body.innerHTML = `
            <div x-is="select" options:class="routed-options">
                <div id="options-region" slot="options" class="server-options">
                    <div id="island-option" x-is="option" value="a">Alpha</div>
                </div>
            </div>
        `;
        const host = document.body.firstElementChild;
        const wrapper = host.querySelector('#options-region');
        const option = host.querySelector('#island-option');

        Alpine.initTree(document.body);
        await tick();
        await tick();

        const listbox = host.querySelector('[role="listbox"]');
        expect(host.querySelector('#options-region')).toBe(wrapper);
        expect(wrapper.parentElement).toBe(listbox);
        expect(wrapper.classList.contains('server-options')).toBe(true);
        expect(wrapper.classList.contains('routed-options')).toBe(true);
        expect(host.querySelector('#island-option')).toBe(option);
        expect(optionState(option).attached).toBe(true);

        HostRuntime.from(host).renderNow();
        await tick();
        expect(host.querySelector('#options-region')).toBe(wrapper);
        expect(host.querySelector('#island-option')).toBe(option);

        const incoming = document.createElement('div');
        incoming.setAttribute('x-is', 'select');
        incoming.setAttribute('options:class', 'updated-options');
        incoming.innerHTML = `
            <div id="options-region" slot="options" class="server-options">
                <div id="island-option" x-is="option" value="a">Alpha</div>
            </div>
        `;
        HostRuntime.from(host).adoptSource(incoming);
        await tick();
        expect(HostRuntime.from(host).component.attrs.get('options:class'))
            .toBe('updated-options');
        expect(host.querySelector('#options-region')).toBe(wrapper);
        expect(wrapper.classList.contains('server-options')).toBe(true);
        expect(wrapper.classList.contains('updated-options')).toBe(true);
        expect(wrapper.classList.contains('routed-options')).toBe(false);

        HostRuntime.from(host.querySelector('dialog[x-is="overlay"]')).renderNow();
        await tick();
        expect(host.querySelector('#options-region')).toBe(wrapper);
        expect(host.querySelector('#island-option')).toBe(option);

        Alpine.destroyTree(host);
        expect(host.firstElementChild).toBe(wrapper);
        expect(wrapper.getAttribute('slot')).toBe('options');
        expect(wrapper.className).toBe('server-options');
    });

    it('rejects ambiguous server-owned option regions', () => {
        const invalid = (html, message) => {
            document.body.innerHTML = html;
            const host = document.body.firstElementChild;
            expect(() => Alpine.initTree(document.body)).toThrow(message);
            HostRuntime.from(host)?.destroy();
            Alpine.destroyTree(document.body);
            document.body.replaceChildren();
        };

        invalid(`
            <div x-is="select">
                <div slot="options"></div>
                <div slot="options"></div>
            </div>
        `, "exactly one top-level element with slot='options'");

        invalid(`
            <div x-is="select">
                <div slot="options"></div>
                <div x-is="option" value="local">Local</div>
            </div>
        `, "cannot mix slot='options' with default-slot option content");
    });

    it('composes a trigger, adaptive overlay, listbox, and styled options', async () => {
        const host = mount(`
            <div x-is="select" placeholder="Choose one">
                <button id="alpha" x-is="option" value="a" label="Alpha"></button>
                <button id="bravo" x-is="option" value="b">
                    <span>Bravo</span>
                    <template slot="selection"><strong class="custom-selection">B</strong></template>
                </button>
            </div>
        `);
        await tick();
        await tick();

        const trigger = host.querySelector('[data-isas-select-trigger]');
        const overlay = host.querySelector('dialog[x-is="overlay"]');
        const listbox = host.querySelector('[role="listbox"]');
        expect(trigger).not.toBeNull();
        expect(trigger.textContent).toContain('Choose one');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.getAttribute('aria-controls')).toBe(overlay.id);
        expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
        expect(overlay.getAttribute('mode')).toBe('adaptive');
        expect(listbox.getAttribute('aria-multiselectable')).toBe('false');
        expect(listbox.contains(host.querySelector('#alpha'))).toBe(true);
        expect(host.querySelector('#alpha').getAttribute('role')).toBe('option');
        expect(host.querySelector('#alpha').textContent).toContain('Alpha');
        expect(host.querySelector('#bravo .custom-selection')).toBeNull();
        expect(HostRuntime.from(host).component).toBeInstanceOf(Select);

        Alpine.destroyTree(host);
        expect(host.querySelector('#alpha').innerHTML).toBe('');
        expect(host.querySelector('#bravo [slot="selection"]').innerHTML).toContain('B');
    });

    it('derives compact fallback selections and preserves explicit selection markup', async () => {
        const host = mount(`
            <div x-is="select" multiple>
                <div x-is="option" value="ada" label="Ada Lovelace"
                    avatar="AL" selected></div>
                <div x-is="option" value="grace" label="Grace Hopper" selected>
                    Grace Hopper
                    <template slot="selection">
                        <span class="authored-selection" x-text="$option.label"></span>
                    </template>
                </div>
            </div>
        `);
        await tick();
        await tick();

        const state = selectState(host);
        const [ada, grace] = state.selectedOptions;
        expect(ada.selectionCustom).toBe(false);
        expect(ada.selection).toContain('Ada Lovelace');
        expect(ada.selection).toContain('option:selection:avatar:ada');
        expect(grace.selectionCustom).toBe(true);
        expect(grace.selection).toContain('$option.label');

        const rendered = [...host.querySelectorAll('[data-isas-select-selection-item]')];
        expect(rendered).toHaveLength(2);
        expect(rendered[0].classList.contains('badge')).toBe(true);
        expect(rendered[0].textContent).toContain('Ada Lovelace');
        expect(rendered[1].classList.contains('badge')).toBe(false);
        expect(rendered[1].querySelector('.authored-selection').textContent)
            .toBe('Grace Hopper');
    });

    it('applies an explicit cap and computes the overflow count', async () => {
        const host = mount(`
            <div x-is="select" multiple max-selection-shown="1">
                <div x-is="option" value="a" selected>A</div>
                <div x-is="option" value="b" selected>B</div>
                <div x-is="option" value="c" selected>C</div>
            </div>
        `);
        await tick();
        await tick();

        const state = selectState(host);
        expect(state.visibleSelectedOptions.map((option) => option.value)).toEqual(['a']);
        expect(state.hiddenSelectedCount).toBe(2);
        expect(host.querySelector('[data-isas-select-more]').textContent).toBe('+2');
        expect([...host.querySelectorAll('[data-isas-select-selection-item]')]
            .filter((item) => !item.hidden)).toHaveLength(1);
    });

    it('ignores the multiple-selection cap for a single value', async () => {
        const host = mount(`
            <div x-is="select" max-selection-shown="0">
                <div x-is="option" value="a" selected>Alpha</div>
            </div>
        `);
        await tick();
        await tick();

        expect(selectState(host).visibleSelectedOptions.map(({ value }) => value))
            .toEqual(['a']);
        expect(selectState(host).hiddenSelectedCount).toBe(0);
        expect(host.querySelector('[data-isas-select-selection-item]').textContent)
            .toContain('Alpha');
        expect(host.querySelector('[data-isas-select-more]')).toBeNull();
    });

    it('shows the explicit cap without applying automatic width fitting', async () => {
        const host = mount(`
            <div x-is="select" multiple max-selection-shown="3">
                <div x-is="option" value="a" selected>Alpha</div>
                <div x-is="option" value="b" selected>Bravo</div>
                <div x-is="option" value="c" selected>Charlie</div>
            </div>
        `);
        await tick();
        await tick();

        expect(selectState(host).visibleSelectedOptions.map((option) => option.value))
            .toEqual(['a', 'b', 'c']);
        expect(selectState(host).hiddenSelectedCount).toBe(0);
        expect([...host.querySelectorAll('[data-isas-select-selection-item]')])
            .toHaveLength(3);
        expect(host.querySelector('[data-isas-select-more]')).toBeNull();
    });

    it('preserves runtime-owned selection nodes across structural rerenders', async () => {
        const host = mount(`
            <div x-is="select" multiple max-selection-shown="3">
                <div x-is="option" value="a" selected>Alpha</div>
                <div x-is="option" value="b" selected>Bravo</div>
                <div x-is="option" value="c" selected>Charlie</div>
            </div>
        `);
        await tick();
        await tick();

        const runtime = HostRuntime.from(host);
        const before = [...host.querySelectorAll('[data-isas-select-selection-item]')];
        expect(before).toHaveLength(3);

        runtime.renderNow();
        await tick();

        const after = [...host.querySelectorAll('[data-isas-select-selection-item]')];
        expect(after).toEqual(before);
        expect(after.map((item) => item.textContent.trim()))
            .toEqual(['Alpha', 'Bravo', 'Charlie']);
        expect(host.querySelector('[data-isas-select-more]')).toBeNull();
    });

    it('supports a custom overflow slot without replacing its markup', async () => {
        const host = mount(`
            <div x-is="select" multiple max-selection-shown="1">
                <strong slot="more" class="custom-more"
                    x-text="$select.hiddenSelectedCount + ' hidden'"></strong>
                <div x-is="option" value="a" selected>A</div>
                <div x-is="option" value="b" selected>B</div>
                <div x-is="option" value="c" selected>C</div>
            </div>
        `);
        await tick();
        await tick();

        const more = host.querySelector('.custom-more');
        expect(more.hidden).toBe(false);
        expect(more.textContent).toBe('2 hidden');
        expect(more.getAttribute('aria-label')).toBe('2 more selected');
        expect(more.getAttribute('data-hidden-count')).toBe('2');
    });

    it('renders every uncapped selection and uses wrapping presentation', async () => {
        const host = mount(`
            <div x-is="select" multiple>
                <div x-is="option" value="a" selected>A</div>
                <div x-is="option" value="b" selected>B</div>
                <div x-is="option" value="c" selected>C</div>
            </div>
        `);
        await tick();
        await tick();

        const items = [...host.querySelectorAll('[data-isas-select-selection-item]')];

        expect(selectState(host).visibleSelectedOptions.map((option) => option.value))
            .toEqual(['a', 'b', 'c']);
        expect(selectState(host).hiddenSelectedCount).toBe(0);
        expect(items).toHaveLength(3);
        expect(host.querySelector('[data-isas-select-more]')).toBeNull();
        expect(host.querySelector('[data-isas-select-selection-items]')
            .classList.contains('flex-wrap')).toBe(true);
    });

    it('filters styled options locally and leaves manual filtering to the consumer', async () => {
        const host = mount(`
            <div x-is="select" searchable>
                <div id="alice" x-is="option" value="1" label="Alice"
                    description="Platform"></div>
                <div id="bob" x-is="option" value="2" label="Bob"
                    keywords="compiler"></div>
            </div>
        `);
        await tick();
        await tick();

        const input = host.querySelector('[data-isas-select-search]');
        input.value = 'platform';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        expect(host.querySelector('#alice').hidden).toBe(false);
        expect(host.querySelector('#bob').hidden).toBe(true);

        host.setAttribute('filter', 'manual');
        await tick();
        input.value = 'compiler';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        expect(host.querySelector('#alice').hidden).toBe(false);
        expect(host.querySelector('#bob').hidden).toBe(false);
    });

    it('supports a zero selection cap with overflow-only feedback', async () => {
        const host = mount(`
            <div x-is="select" multiple max-selection-shown="0">
                <div x-is="option" value="a" selected>Alpha</div>
                <div x-is="option" value="b" selected>Bravo</div>
            </div>
        `);
        await tick();
        await tick();

        expect(selectState(host).visibleSelectedOptions).toEqual([]);
        expect(selectState(host).hiddenSelectedCount).toBe(2);
        expect(host.querySelector('[data-isas-select-selection-item]')).toBeNull();
        expect(host.querySelector('[data-isas-select-more]').textContent).toBe('+2');
    });

    it('lets a complete selection slot own layout while exposing the explicit cap', async () => {
        const host = mount(`
            <div x-is="select" multiple max-selection-shown="1">
                <span slot="selection" class="custom-layout">
                    <template x-for="option in $select.selectedOptions" :key="option.value">
                        <em x-text="option.label"></em>
                    </template>
                </span>
                <div x-is="option" value="a" selected>Alpha</div>
                <div x-is="option" value="b" selected>Bravo</div>
            </div>
        `);
        await tick();
        await tick();

        expect(host.querySelector('.custom-layout').textContent).toContain('Alpha');
        expect(host.querySelector('.custom-layout').textContent).toContain('Bravo');
        expect(host.querySelector('[data-isas-select-selection-item]')).toBeNull();
        expect(selectState(host).visibleSelectedOptions.map((option) => option.value))
            .toEqual(['a']);
        expect(selectState(host).hiddenSelectedCount).toBe(1);
    });

    it('closes after single activation and lets dialog controls close without model events', async () => {
        const host = mount(`
            <div x-is="select" mode="dialog">
                <div id="option" x-is="option" value="a">Alpha</div>
            </div>
        `);
        await tick();
        await tick();

        const component = HostRuntime.from(host).componentFor('select');
        const close = vi.spyOn(component, 'close').mockReturnValue(true);
        const events = [];
        host.addEventListener('input', () => events.push('input'));
        host.addEventListener('change', () => events.push('change'));

        host.querySelector('#option').click();
        await tick();
        expect(selectState(host).value).toBe('a');
        expect(close).toHaveBeenCalledOnce();
        expect(events).toEqual(['input', 'change']);

        events.length = 0;
        host.querySelector('[data-isas-select-close]').click();
        expect(close).toHaveBeenCalledTimes(2);
        expect(events).toEqual([]);
        expect(host.querySelector('[data-isas-select-dialog-only]').hidden).toBe(false);
    });

    it('keeps multiple dialog selection open and makes Done close-only', async () => {
        const host = mount(`
            <div x-is="select" multiple mode="dialog">
                <div id="alpha" x-is="option" value="a" selected>Alpha</div>
                <div id="bravo" x-is="option" value="b">Bravo</div>
            </div>
        `);
        await tick();
        await tick();

        const component = HostRuntime.from(host).componentFor('select');
        const close = vi.spyOn(component, 'close').mockReturnValue(true);
        const events = [];
        host.addEventListener('input', () => events.push('input'));
        host.addEventListener('change', () => events.push('change'));

        host.querySelector('#bravo').click();
        await tick();
        expect(selectState(host).value).toEqual(['a', 'b']);
        expect(close).not.toHaveBeenCalled();
        expect(events).toEqual(['input', 'change']);

        events.length = 0;
        host.querySelector('[data-isas-select-done]').click();
        expect(close).toHaveBeenCalledOnce();
        expect(events).toEqual([]);
    });

    it('navigates enabled visible styled options with listbox keys', async () => {
        const host = mount(`
            <div x-is="select">
                <div id="alpha" x-is="option" value="a">Alpha</div>
                <div id="disabled" x-is="option" value="x" disabled>Disabled</div>
                <div id="bravo" x-is="option" value="b">Bravo</div>
            </div>
        `);
        await tick();
        await tick();

        const alpha = host.querySelector('#alpha');
        const bravo = host.querySelector('#bravo');
        alpha.focus();
        alpha.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
        }));
        expect(document.activeElement).toBe(bravo);

        bravo.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
        }));
        await tick();
        expect(selectState(host).value).toBe('b');
        expect(bravo.getAttribute('aria-selected')).toBe('true');
    });

    it('keeps search input/change events away from the select model listener', async () => {
        const host = mount(`
            <div x-is="select" searchable>
                <div x-is="option" value="a">Alpha</div>
            </div>
        `);
        await tick();
        await tick();

        const events = [];
        host.addEventListener('input', () => events.push('input'));
        host.addEventListener('change', () => events.push('change'));
        const search = host.querySelector('[data-isas-select-search]');
        search.value = 'alp';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search.dispatchEvent(new Event('change', { bubbles: true }));
        await tick();

        expect(selectState(host).query).toBe('alp');
        expect(events).toEqual([]);
    });
});
