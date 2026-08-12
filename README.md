# x-isas

An Alpine-first component runtime for ordinary HTML elements. It combines one
structural `x-is` component with optional functional `x-as` attachments,
without Custom Elements or Shadow DOM.

## Install

```js
import Alpine from 'alpinejs'
import morph from '@alpinejs/morph'
import isas from 'x-isas'

globalThis.Alpine = Alpine
Alpine.plugin(morph)
Alpine.plugin(isas)
Alpine.start()
```

For applications such as Livewire that own Alpine startup, call `autoInstall()`
before Alpine initializes. Livewire already provides Alpine and its Morph plugin.

The root entry installs the default DaisyUI adapters. To use the component
runtime without a visual adapter, import the neutral entry instead:

```js
import isas, { Isas } from 'x-isas/core'
import {
    buttonAdapter,
    installDaisyUIAdapters,
} from 'x-isas/adapters/daisyui'

// Install the complete DaisyUI adapter set.
installDaisyUIAdapters()
```

For selective setup, omit `installDaisyUIAdapters()` and register only the
adapters the application needs:

```js
Isas.adapters.register('button', buttonAdapter)
```

Choose and register adapters before `Alpine.start()`. Switching adapters on an
already-rendered page is not supported.

### Opt-in Calendar and DatePicker

Calendar support is deliberately excluded from the default entry. Import the
calendar entry before Alpine starts to register `calendar`, `date-picker`, and
the `date-preset` attachment together with their DaisyUI adapters:

```js
import isas from 'x-isas/calendar'

Alpine.plugin(isas)
```

`calendar` is the standalone surface. `date-picker` composes the same calendar
into the existing adaptive Overlay and participates in forms through a generated
native control. Values are plain ISO calendar dates: `YYYY-MM-DD` for single
selection and `YYYY-MM-DD/YYYY-MM-DD` for ranges.

Calendars use the compact `layout="fit"` presentation by default. Opt into a
specific available width with `layout="fill"`; the host or DatePicker overlay
then supplies that width through normal classes:

```html
<div x-is="calendar" layout="fill" class="w-full max-w-3xl"></div>
<div x-is="date-picker" layout="fill" overlay:class="w-[40rem]"></div>
```

When DatePicker omits `layout`, it chooses from the active Overlay
presentation: dropdowns use `fit` and dialogs use `fill`. Adaptive pickers
update that implicit layout when their presentation changes at the configured
breakpoint. An authored `layout` always overrides this behavior.

```html
<div x-is="date-picker" x-model="period" selection="range" name="period">
    <button x-as="date-preset" preset="last-7-days">Last 7 days</button>
    <button x-as="date-preset" value="2026-01-01/2026-03-31">Q1</button>
</div>
```

DatePicker displays locale-aware medium dates by default. `date-style` accepts
`full`, `long`, `medium`, or `short`; ranges use the browser's localized compact
range representation without changing the canonical model value. A `value`
slot replaces only the visual value inside the generated trigger and can read
both `$datePicker.value` and `$datePicker.displayValue`:

```html
<div x-is="date-picker" x-model="period" selection="range" date-style="long">
    <span slot="value" x-text="formatPeriod($datePicker.value)"></span>
</div>
```

The slot is used only for a committed non-empty value. The `placeholder`
remains visible for empty values and while a new range is only a draft.

DatePicker is an independent field component rather than an Input composed
under the hood. Its generated trigger shell follows Input's DaisyUI contract:
`size="xs|sm|md|lg|xl"`, the standard semantic `color` values, and
`variant="ghost"`. Missing or unknown values retain the base Input appearance;
a visible validation error temporarily overrides `color` with `input-error`.

Use `icon` and `icon-end` for quick accessories, or author `prepend` and
`append` slots. An authored slot wins on its side, and `icon-end` replaces the
default calendar icon. Accessory parts accept their normal routed attributes.
Interactive authored accessories keep their own behavior; clicking other
accessory content opens the picker.

```html
<div x-is="date-picker" size="sm" color="primary"
    icon="i-tabler-truck" icon-end="i-tabler-calendar-event"
    clearable x-model="deliveryDate"></div>
```

`clearable` renders a sibling action only while a committed value exists, so
the trigger never contains nested buttons. It cancels an incomplete range,
commits an empty value, updates Alpine, Livewire, and native forms, and emits
bubbling `input` and `change` events. Customize it with `clear-action:*` and
`clear-icon:*`. Disabled and readonly pickers cannot be cleared. The same
guarded operation is available as `$datePicker.clear()`.

The DatePicker host remains independent from the calendar's adaptive layout:
switching from dropdown to dialog does not resize the closed field. Use normal
host classes such as `class="w-full"` for field width and routed part classes
for narrower customization.

Customize every day with one single-root template, then override specific
canonical dates with additional templates. The root is the real keyboard and
ARIA day trigger and receives a read-only `$day` object, so it can also host
x-isas attachments:

```html
<div x-is="calendar">
    <template slot="day">
        <button x-as="tooltip" x-bind:tooltip="$day.label" x-text="$day.number"></button>
    </template>
    <template slot="day" date="2026-12-25">
        <button class="btn btn-accent">★</button>
    </template>
</div>
```

### Opt-in FileUpload

FileUpload is also excluded from the default entry. Import the upload slice
before Alpine starts; this registers the component, DaisyUI adapter, Zag
selection driver, and built-in Livewire and endpoint transports:

```js
import isas, { uploadTransports } from 'x-isas/upload'

Alpine.plugin(isas)
```

The default inline mode keeps a real native file input and submits binaries
through an ordinary multipart form. `accept`, `multiple`, `required`,
`max-files`, `min-file-size`, and `max-file-size` are applied before a file is
accepted. Exact duplicate fingerprints are rejected unless
`allow-duplicates` is present.

```html
<div x-is="file-upload" name="documents[]" multiple required
    accept="image/*,.pdf" max-files="5" max-file-size="10485760"></div>
```

Use `mode="adaptive|dropdown|dialog"` for the compact paperclip/count trigger.
Its main button opens the shared Overlay as a desktop dropdown or mobile bottom
dialog. Add `quick-add` when a sibling action should open the device picker
directly; `$fileUpload.openPicker()` remains available to authored controls.

Records are grouped into `files` and `attention` sections by default. Set
`grouping="none"` for one flat list. `$fileUpload.groups` exposes the same
presentation groups, while `$file.attention`, `active`, `complete`, and
`retryable` simplify custom rows. `list:class` changes every group to a grid or
tile layout without changing behavior, and one single-root file template
receives the reactive `$file` facade:

```html
<div x-is="file-upload" mode="dialog" multiple
    list:class="grid grid-cols-2 gap-3">
    <template slot="file">
        <article>
            <strong x-text="$file.name"></strong>
            <span x-text="$file.sizeText"></span>
            <button type="button" @click="$file.remove()">Remove</button>
        </article>
    </template>
</div>
```

Existing `value`, `prepend`, `append`, `dropzone`, `empty`, `error`, and
`dialog-title` slots remain available. `description`, `header-actions`,
`files-label`, `attention-label`, and `footer` customize the polished surface
without replacing its native input, accessible title, or close control. An
authored footer replaces the dialog's default close-only **Done** action.

On a Livewire host, `wire:model` identifies the upload property. FileUpload
uses Livewire's JavaScript upload API once per file so every record has its own
progress, failure, retry, and cancellation state; it never assigns browser
`File` objects through the model. The PHP component must use
`WithFileUploads`, and multiple properties should start as arrays:

```html
<div x-is="file-upload" wire:model="photos" multiple></div>
```

An `upload-url` selects the endpoint transport. It posts one multipart file at
a time, accepts `{ "token": "..." }` JSON, and renders successful tokens as
hidden controls using `token-name` or `name`. Optional response fields are
`jobId`, `previewUrl`, `downloadUrl`, `deleteUrl`, and `metadata`. Endpoint
uploads default to three concurrent requests. Set `upload-mode="manual"` to
stage files until `$fileUpload.upload()` or `uploadAll()` is called.

Custom transports register through `uploadTransports.register(name, factory)`.
`start(record, callbacks)` returns `{ jobId?, result, cancel() }`; `result` is
a Promise. Optional `restore(jobId, callbacks)` and `remove(result, context)`
form the forward-compatible boundary for durable or service-worker-backed
jobs. FileUpload itself does not promise background uploads.

## Display and platform

The plugin exposes a reactive `$display` magic for viewport breakpoints and
best-effort platform information. Its default boundaries match Tailwind CSS:

| Name | Minimum width |
| --- | ---: |
| `xs` | 0px |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `xxl` | 1536px |

`xxl` corresponds to Tailwind's `2xl` prefix while remaining convenient to use
as a JavaScript property. Exact breakpoint flags are true only inside their
range; `mdAndUp` and `mdAndDown` provide inclusive-lower and exclusive-upper
range checks. The default mobile breakpoint is `lg`, so `mobile` is true below
1024px.

```html
<div x-data>
    <span x-text="`${$display.name}: ${$display.width} × ${$display.height}`"></span>
    <nav x-show="$display.lgAndUp">Desktop navigation</nav>
</div>
```

Width, height, breakpoint flags, and dependent Alpine expressions update when
the browser window is resized. `$display` contains:

- `width`, `height`, `name`, `mobile`, `mobileBreakpoint`, and `thresholds`
- `xs`, `sm`, `md`, `lg`, `xl`, and `xxl`
- `smAndUp` / `smAndDown` through `xlAndUp` / `xlAndDown`
- `platform`, with `android`, `ios`, `cordova`, `electron`, `chrome`, `edge`,
  `firefox`, `opera`, `win`, `mac`, `linux`, `touch`, and `ssr` flags

Configure thresholds before installing x-isas. Partial threshold objects merge
with the defaults, and `mobileBreakpoint` accepts a breakpoint name or a pixel
number:

```js
import Alpine from 'alpinejs'
import isas, { display } from 'x-isas'

display.configure({
    thresholds: { md: 800, lg: 1100 },
    mobileBreakpoint: 'md',
})

globalThis.Alpine = Alpine
Alpine.plugin(isas)
Alpine.start()
```

For `autoInstall()`, call `display.configure()` before `autoInstall()`. Runtime
JavaScript, including components and adapters, can read the same reactive
object through `display.state` after the plugin has installed. Thresholds use
pixel numbers, must remain strictly increasing, and cannot be changed after
installation. Platform flags are inferred from browser capabilities and the
user agent, so treat them as hints rather than authoritative device detection.

### Optional DaisyUI adapter CSS

x-isas does not load presentation styles from its JavaScript entry. Applications
using Tailwind CSS and DaisyUI can opt in from their main stylesheet:

```css
@import 'x-isas/styles.css';
```

`x-isas/styles.css` aliases the canonical
`x-isas/adapters/daisyui/styles.css` export. The aggregate stylesheet keeps
DaisyUI-specific rules beside their adapters and declares the adapter and
component JavaScript as Tailwind sources, so generated presentation classes are
emitted. Process it through the application's Tailwind pipeline after DaisyUI
is configured.

## Presentation adapters

Each component name may have one presentation adapter. An adapter reads the
resolved render attributes and slots, then returns defaults for the host and
generated parts. The runtime merges and owns those defaults, so authored values
win and obsolete classes are removed on later renders.

```js
import { Isas } from 'x-isas'

Isas.adapters.register('notice', ({ attrs }) => ({
    host: { class: attrs.get('tone') === 'warning' ? 'alert alert-warning' : 'alert' },
    parts: { icon: { class: 'shrink-0' } },
}))
```

Registrations are normalized by component name. Registering a different
adapter for the same name throws unless `{ replace: true }` is supplied.
Adapters should be registered before Alpine initializes.

### Custom rendering

An adapter may also be a descriptor with optional `attributes` and `render`
methods. Existing adapter functions are attributes-only shorthand, so they
can be reused when replacing only a component's markup:

```js
import { Isas } from 'x-isas'
import { buttonAdapter } from 'x-isas/adapters/daisyui'

Isas.adapters.register('button', {
    attributes: buttonAdapter,

    render({ attrs, slots, view, renderDefault }) {
        return `
            <span class="my-button-content" data-has-icon="${view.hasPrepend}">
                ${view.hasPrepend
                    ? `<span ${attrs.for('prepend').toString()}>${slots.get('prepend').html()}</span>`
                    : ''}
                ${slots.get('default').html()}
                ${view.hasAppend
                    ? `<span ${attrs.for('append').toString()}>${slots.get('append').html()}</span>`
                    : ''}
            </span>
        `
    },
}, { replace: true })
```

The render hook receives final resolved attributes, prepared semantic slots,
the component's prepared `view`, and a memoized `renderDefault()` callback.
`icon` and `icon-end` have therefore already been promoted to `prepend` and
`append` when the hook runs. Calling `renderDefault()` explicitly invokes the
component's original renderer; returning `undefined` performs no child update,
while returning `null` clears the children.

When an element from a named slot is projected, the runtime replaces its
authoring-only `slot` attribute with `data-isas-slot` in the rendered DOM. A
nested component adapter can therefore inspect its logical owner context:

```js
import { SLOT_CONTEXT_ATTRIBUTE } from 'x-isas'

export function nestedAdapter({ attrs }) {
    const slot = attrs.get(SLOT_CONTEXT_ATTRIBUTE) // for example, "append"
}
```

The marker is runtime-owned, excluded from Alpine component state, and absent
for implicit default-slot content. Canonical source and teardown retain the
original `slot` attribute.

Custom rendering replaces only the native host's light-DOM contents. The host,
component lifecycle, functional attachments, bindings, and canonical authored
source remain owned by the runtime. Adapter render output is trusted HTML
under the same contract as `Component.render()`.

## Shallow parts

Components may declare parent-local structural parts. An authored `x-part`
keeps its native host element, owns a scoped slot bag, and is rendered by the
owning component without creating another `x-is` runtime, namespace,
attachment set, registry entry, or adapter:

```html
<article x-is="card">
    <div x-part="body" body-state="ready">
        <h2 slot="title">Scoped title</h2>
        <p>Body content</p>
        <div slot="actions"><button>Continue</button></div>
    </div>
</article>
```

Only direct children of the nearest `x-is` owner may be parts. A nested `x-is`
host starts a new ownership boundary, so ancestor components ignore every
`x-part` in that subtree and the nested component validates its own direct
parts. Ordinary wrappers and `x-as` hosts do not create ownership boundaries.
Part names are literal, must be declared by the owning component, and cannot
share a host with `slot`, `x-is`, or `x-as`. Repeated names are supported and
remain source ordered. Nested slots belong to their part and do not appear in
the parent's root `SlotBag`.

Component authors declare structural hooks locally:

```js
class Panel extends Component {
    static parts = {
        body: {
            tag: 'section',
            prepare({ attrs, slots, index }) {
                return { emphasized: attrs.boolean('emphasized'), index }
            },
            render({ slots }) {
                return `${slots.get('title').html()}${slots.get('default').html()}`
            },
        },
    }

    render() {
        return this.parts.ordered().map(part => part.html()).join('')
    }
}
```

`PartBag` provides `has(name)`, `first(name)`, `all(name)`, `ordered()`, and
`clone()`. Adapters receive a cloned `parts` bag and may contribute per-part
host, nested-slot, and generated inner-part presentation. A callback runs
independently for each occurrence:

```js
Isas.adapters.register('panel', () => ({
    parts: {
        body: ({ attrs, index }) => ({
            host: { class: attrs.boolean('compact') ? 'panel-body compact' : 'panel-body' },
            slots: { title: { class: `panel-title panel-title-${index}` } },
            parts: { content: { class: 'panel-content' } },
        }),
    },
}))
```

Component-host namespaces such as `body:class` apply to every occurrence;
`body:title:class` targets nested title slots. Attributes on an authored body
and then on its nested slot element take precedence. Alpine-bound part
attributes re-run the owning component and adapter while stale managed
classes and styles are removed.

## Native surfaces

`dropdown`, `dialog`, and `overlay` are nonstructural targets controlled by
functional trigger attachments linked through IDs:

```html
<button x-is="button" controls-dialog="account-settings">
    Open settings
</button>

<dialog
    x-is="dialog"
    id="account-settings"
    closedby="closerequest"
    aria-labelledby="account-settings-title"
>
    <section x-part="content">
        <h2 id="account-settings-title">Account settings</h2>
        <p>Stateful body content.</p>
        <footer class="modal-action">
            <button @click="$dialog.close('cancelled')">Cancel</button>
            <button @click="$dialog.close('saved')">Save</button>
        </footer>
    </section>
</dialog>
```

`controls-dropdown`, `controls-dialog`, and `controls-overlay` are activation
attributes, not standalone directives. Their host must also declare `x-is` or
an explicit `x-as`, such as
`x-as="dialog-trigger:$loginDialog"`. Implicit trigger namespaces are
`$dropdown`, `$dialog`, and `$overlay`; trigger and target scopes proxy the
same controller even when their local namespace names differ.

Targets require unique non-empty IDs. Either DOM order and multiple triggers
are supported. Dialog requires an authored `<dialog>` and dialog/overlay
targets require exactly one direct `x-part="content"`. Dropdown children are
unrestricted. No shell or wrapper is generated, and consumer children are
never moved, cloned, or reinitialized.

Every target and trigger exposes writable `open`, read-only `presentation`,
`target`, `activeTrigger`, `linked`, and the common `show()`, `hide()`,
`close()`, `toggle()`, and `requestClose()` methods. Dialog adds `returnValue`
and `closedBy`; overlay adds `mode`, `breakpoint`, and `closedBy`.

Overlay accepts `mode="adaptive|dropdown|dialog"`, bound mode/breakpoint
attributes, `dropdown:placement`, and `dialog:placement`. Adaptive mode uses
`$display.mobileBreakpoint`. An authored `<dialog x-is="overlay">` switches
the same node between Popover and `showModal()`; other hosts provide a
popover-backed dialog-like presentation without claiming native modality,
inertness, or hardware-Back guarantees.

Native dialog presentations support `closedby="any|closerequest|none"`,
platform close requests, cancel prevention, return values, and focus
restoration. Compatibility fallbacks cover Escape and pointer dismissal where
possible without adding session-history sentinels.

The DaisyUI adapter applies `dropdown`, placement modifiers, and
`dropdown-open` to dropdown targets. Dialog presentation applies `modal` to
the authored target and `modal-box` to its content part. Consumers own
`modal-action` and dropdown visuals. Standalone dialogs default to
`modal-middle`; adaptive overlays default to `modal-bottom`.

## Primitive components

```html
<button
    x-is="button"
    class="explicit-class"
    color="primary"
    size="xs"
    variant="soft"
    shape="circle"
    active
    icon="i-tabler-info-circle"
    icon:class="animate-pulse"
    icon-end="i-tabler-chevron-right"
>
    Click Me
</button>
```

The button remains a native `<button>`. Its adapter adds `btn`, recognized
`btn-{color}`, `btn-{size}`, and `btn-{variant}` classes before
`explicit-class`. Supported variants are `outline`, `dash`, `soft`, `ghost`,
and `link`. `shape="square|circle"`, `wide`, `block`, and `active` apply the
matching DaisyUI modifiers. `icon` is promoted into the prepend wrapper and
`icon-end` into the append wrapper. Their namespaced attributes target each
generated icon, while `prepend:*` and `append:*` target the wrappers. The
adapter supplies the wrappers' inline-flex alignment classes. Explicit slot
content wins over its matching convenience prop.

The boolean `loading` attribute adds a DaisyUI spinner and `aria-busy="true"`
without implicitly disabling the native button. While loading, the spinner
replaces a generated leading `icon` and is inserted before authored prepend
content. Removing `loading` restores the generated icon; use `disabled`
separately when repeat activation must be prevented.

### Alert

Alert renders one stable content region between optional leading and trailing
accessories. Its DaisyUI adapter supports the semantic `info`, `success`,
`warning`, and `error` colors; the `soft`, `outline`, and `dash` variants; and
`direction="vertical|horizontal"`:

```html
<div
    x-is="alert"
    role="status"
    color="info"
    variant="soft"
    icon="i-tabler-info-circle"
    badge="New"
    heading="Workspace updated"
>
    Your changes are now available to the team.

    <div slot="append">
        <button x-is="button" size="sm">Review</button>
    </div>
</div>
```

`icon` and `badge` populate `prepend`; `icon-end` and `badge-end` populate
`append`. Generated badges are nested Badge components and default to `sm`.
Use the corresponding attribute namespace to customize them. An authored
`prepend` or `append` slot replaces every shorthand on that side and may contain
arbitrary components.

`heading` and `description` accept either attributes or named slots, with slots
taking precedence. When a heading has no explicit description, the default slot
becomes its description. Customize generated regions through `prepend:*`,
`content:*`, `heading:*`, `description:*`, and `append:*`. The native `title`
attribute keeps its browser-tooltip meaning.

Alert does not add `role` or `aria-live`. Choose `role="alert"` for urgent
dynamic updates and `role="status"` for polite notices. Responsive direction
can use DaisyUI classes directly, for example
`direction="vertical" class="sm:alert-horizontal"`.

## Alpine namespaces

The runtime exposes `$host` whenever at least one component on the host is
scoped. It contains `el` plus coerced, camel-cased reactive host attributes.
Those attributes are also projected into each scoped component namespace:

```html
<button x-is="button" count="2">
    <span x-text="$host.count + $button.count"></span>
</button>

<button x-is="button:action" label="Save">
    <span x-text="action.label"></span>
</button>

<div x-is="unknown-card:$card" status="ready">
    <span x-text="$card.status"></span>
</div>
```

The suffix after the first `:` is an explicit JavaScript identifier and is
used verbatim. `$host` is reserved. Unknown `x-is` component names use the
pass-through base component.

Components merge helpers, accessors, and local reactive state into their own
namespace with `mergeScope()`:

```js
class SearchInput extends Component {
    mount() {
        this.state = this.reactive({ disabled: false });
    }

    clear() {
        // Clear the component's native control.
    }

    mergeScope() {
        return {
            clear: this.clear,
            query: '',
            get isDisabled() {
                return this.state.disabled;
            },
        };
    }
}
```

Methods and accessors are bound to the contributing instance. Plain values are
writable reactive namespace state and persist across component rerenders. Use
getters and setters when namespace state must stay synchronized with component
state. Contributed names take precedence over mirrored attribute-derived
properties, while `$host` retains the raw attribute value.

Set `static scoped = false` to opt a component out by default. The
`x-is.scoped`, `x-is.unscoped`, `x-as.scoped`, and `x-as.unscoped` modifiers
override the class default for a declaration. `$host` is omitted when every
component on the host is unscoped.

## Functional attachments

An attachable component declares `static attachable = true`. `x-as` runs its
functional lifecycle and scope, but never its adapter, parts,
`prepareRender()`, `render()`, or `hostAttributes()`. It supports literal,
array, and object forms:

```html
<div x-as="option"></div>
<div x-as="['option:choice', 'filterable']"></div>
<div x-as="{ 'option:choice': { enabled: true }, filterable: {} }"></div>
```

The first host exposes `$host` and `$option`. The second exposes `$host`,
`choice`, and `$filterable`. Configuration objects are frozen. Component names
and namespaces must be unique on a host, and the primary `x-is` component
cannot also be attached through `x-as`.

An attachable component may declare a literal activation attribute. The runtime
implicitly attaches it only to primary `x-is` hosts that declare that attribute,
including `:` and `x-bind:` forms:

```js
class Described extends Component {
    static attachable = true
    static activationAttribute = 'description'
}
```

Implicit attachments use the component's normal namespace and are reconciled
without remounting unrelated explicit attachments. Object-spread bindings are
not inspected.

## Tooltip

Any primary component can opt into a tooltip without changing its host
structure:

```html
<button
    x-is="button"
    tooltip="Save changes"
    tooltip:placement="top"
    tooltip:align="center"
    tooltip:color="primary"
>
    Save
</button>
```

`placement` accepts `top`, `right`, `bottom`, or `left`; `align` accepts
`start`, `center`, or `end`. Defaults are `top` and `center`.
`tooltip:position` remains an alias when `tooltip:placement` is absent. The
Tooltip attachment creates a generated body-level `x-is="tooltip"` overlay, so
the Tooltip adapter runs even though attachment adapters remain disabled.
The overlay mirrors the trigger rectangle in the native top layer. Floating UI
selects the best complete fallback side while the adapter owns the visual
placement.

Use a non-empty template for formatted, non-interactive content. It takes
precedence over the escaped `tooltip` text:

```html
<button x-is="button" tooltip tooltip:placement="right">
    Help
    <template slot="tooltip">
        <strong>Keyboard shortcut:</strong> Ctrl+S
    </template>
</button>
```

The attachment exposes writable `$tooltip.open` plus read-only
`$tooltip.preferredPlacement`, `$tooltip.placement`, `$tooltip.side`,
`$tooltip.align`, and `$tooltip.isFlipped`. Pointer hover and focus on the
trigger or generated tooltip content update the same open state automatically,
so it remains open while traversing between them. `tooltip:class` and
`tooltip:content:*` customize the generated overlay. Replacing the registered
`tooltip` adapter changes its presentation without changing collision or
accessibility behavior. A replacement adapter may render a descendant
marked `data-isas-floating-arrow` to opt into Floating UI arrow coordinates.

Rich templates retain the trigger's Alpine data stack across the body portal,
using the same logical-parent behavior as `x-teleport`. Nested `x-is` content
is also reconciled when Livewire adopts a new trigger source. Rich content can
receive pointer and focus interaction, but an ARIA tooltip should remain
descriptive in production; controls semantically belong in a popover.

## Avatar

Avatar keeps the element carrying `x-is` as the DaisyUI host and renders one
inner content container. Ordinary host attributes stay on the host; use the
`content:*`, `image:*`, and `icon:*` namespaces for generated parts:

```html
<div
    x-is="avatar"
    size="xl"
    color="primary"
    status="online"
    src="/profile.jpg"
    alt="Profile photo"
    content:class="rounded-full ring-2 ring-primary/30"
    image:loading="lazy"
></div>
```

The adapter adds `avatar`, maps `online` and `offline` status, and contributes
size and color classes to the content part. Sizes are `xs`, `sm`, `md`, `lg`,
`xl`, and `adaptive`; `md` is the default. Colors use the same validated set as
button and badge, with `neutral` as the default.

Non-empty authored content wins over `src`, which wins over `icon`. Initials,
icons, and empty content automatically add `avatar-placeholder`; image content
does not. Set `placeholder` or `placeholder="false"` to override detection.
Host `alt` supplies the generated image default, while `image:alt` takes
precedence. A custom adapter renderer receives the resolved default slot plus
`view.source`, `view.hasImage`, `view.placeholder`, and `view.hasContent`.

## Badge

The badge adapter adds `badge`, maps the same validated color set as button
to `badge-{color}`, and maps `xs`, `sm`, `md`, `lg`, and `xl` to the matching
size class. It supports the same five variants and the same `icon` / `icon-end`
composition contract as button. Authored host and named-part classes are merged
last:

```html
<span
    x-is="badge"
    color="success"
    size="sm"
    variant="outline"
    icon="i-tabler-check"
    icon-end="i-tabler-chevron-right"
>
    Ready
</span>
```

## Card

Card uses `x-part="body"` to model DaisyUI's nested body/title/actions
structure while keeping every host an ordinary authored HTML element:

```html
<article x-is="card" size="lg" variant="border" side>
    <figure slot="figure"><img src="cover.jpg" alt="Cover"></figure>
    <section x-part="body">
        <h2 slot="title">Card title</h2>
        <p>Card content</p>
        <footer slot="actions"><button x-is="button">Open</button></footer>
    </section>
    <figure slot="figure-end"><img src="back.jpg" alt="Back"></figure>
</article>
```

`size` accepts `xs`, `sm`, `md`, `lg`, and `xl`. `variant` accepts `border`
and `dash`; boolean `side` and `image-full` map to the matching DaisyUI
modifiers. `figure` renders before all bodies and `figure-end` after them.
Multiple bodies are allowed and each owns independent slots and attributes.

For compatibility, direct default, `title`, and `actions` slots are aggregated
into one generated body. When mixed with authored bodies, that generated body
is placed at the first legacy node's source position.

## Chat

Chat represents one message rather than a conversation controller. Default
content becomes the bubble, while `avatar`, `header`, and `footer` provide a
concise path through DaisyUI's optional regions:

```html
<article
    x-is="chat"
    placement="start"
    color="primary"
    avatar="/obi-wan.jpg"
    avatar:alt="Obi-Wan Kenobi"
    header="Obi-Wan Kenobi"
    footer="Delivered"
    aria-label="Message from Obi-Wan Kenobi"
>
    You were the Chosen One!
</article>
```

`placement` accepts `start` and `end`, defaulting to `start` when omitted.
Unknown values add no placement modifier, so authored classes remain usable.
`color` maps `neutral`, `primary`, `secondary`, `accent`, `info`, `success`,
`warning`, and `error` to the bubble. Responsive DaisyUI classes remain
ordinary authored classes, for example `placement="start" class="sm:chat-end"`.

The optional `image`, `header`, `bubble`, and `footer` slots accept arbitrary
markup. Their precedence is `image` over `avatar`, `header` over the escaped
`header` attribute, `bubble` over default content, and `footer` over the
escaped `footer` attribute:

```html
<article x-is="chat" placement="end" color="info"
    bubble:class="max-w-lg" footer:class="opacity-60">
    <span x-is="avatar" slot="image">AL</span>
    <span slot="header">
        Ada Lovelace <time datetime="09:30">09:30</time>
    </span>
    <div slot="bubble"><strong>Rich</strong> message content</div>
    <span slot="footer">Seen</span>
</article>
```

A string `avatar` value becomes the generated Avatar's `src`; bare or true
`avatar` creates its placeholder, and false disables it. `avatar:*` customizes
that stable nested Avatar component. Use `image:*`, `header:*`, `bubble:*`, and
`footer:*` for the generated region wrappers. An authored `image` slot replaces
the Avatar convenience completely.

Use `raw` when direct DaisyUI children, tags, classes, or ordering must remain
fully consumer-owned. The Chat adapter still maps the host and placement, but
does not rewrite raw children or apply `color` to them:

```html
<div x-is="chat" raw placement="end">
    <div class="chat-header">Author</div>
    <div class="chat-bubble chat-bubble-accent">Exact raw markup</div>
    <div class="chat-footer opacity-50">Sent</div>
</div>
```

Composed mode rejects unsupported named slots and visible default content mixed
with an explicit `bubble` slot. Chat does not add roles, live-region behavior,
accessible names, `<time>` elements, delivery state, or thread management;
author those semantics for the surrounding product experience.

## Countdown

The countdown component converts each digit into a DaisyUI `--value` span and
leaves separators or labels as visible text spans. Its adapter adds the
`countdown` and `font-mono` host classes automatically:

```html
<span x-is="countdown" class="text-4xl" value="12:34:56"></span>
<span x-is="countdown:timer">launch T-10:09:08</span>
```

The `value` attribute takes precedence over default slot text. x-isas does not
add color or sizing classes to countdown.

## Divider

Divider keeps the native element carrying `x-is` as its host. The adapter
adds `divider`, defaults to `divider-vertical`, and maps `horizontal` plus
`start` or `end` placement to their matching DaisyUI classes. It supports the
neutral, primary, secondary, accent, success, warning, info, and error colors:

```html
<div x-is="divider" color="primary" placement="start" adaptive label="OR"></div>
<div x-is="divider" direction="horizontal">Authored content</div>
<hr x-is="divider" color="secondary" label="Ignored">
```

Non-empty authored content wins over `label`; whitespace and comment-only
content use the label fallback. Labels are always rendered as text. When
`adaptive` is true, vertical dividers receive `--divider-m: 0.5em 0` and
horizontal dividers receive `--divider-m: 0 0.5em`.

Native HTML void elements such as `hr`, `br`, and `input` never receive child
content, so their `label` is ignored.

Divider declares `static scoped = false`, so it exposes neither `$host` nor
`$divider` by default. Use `x-is.scoped="divider"` for a scoped instance.

## Dock

Dock owns repeated, tag-agnostic `item` parts and lets DaisyUI provide its
fixed bottom positioning and safe-area padding. Use semantic navigation and
interaction elements appropriate to the application:

```html
<nav x-is="dock" size="md" aria-label="Primary navigation">
    <a x-part="item" href="/home" icon="i-tabler-home"
        label="Home" active aria-current="page"></a>

    <button x-part="item" type="button" icon="i-tabler-search">
        Search
    </button>

    <div x-part="item">
        <span slot="icon"><span class="i-tabler-user"></span></span>
        <span slot="label"><strong>Profile</strong></span>
    </div>
</nav>
```

`size="xs|sm|md|lg|xl"` maps to the corresponding `dock-*` modifier. Missing
or unknown values keep DaisyUI's base size, and authored responsive classes
remain composable. A truthy `active` attribute adds `dock-active`; `false`,
`0`, and `null` do not. Dock does not enforce one active item or synthesize
navigation state, events, roles, or ARIA. Consumers should add
`aria-current="page"`, `aria-pressed`, disabled behavior, and labels according
to the chosen item elements.

Items without composition conveniences retain their exact children, allowing
raw SVGs and authored `.dock-label` markup. `icon`, `label`, an `icon` or
`label` slot, and their namespaces enable composed mode. An icon slot replaces
the shorthand. Label precedence is the named slot, non-empty default content,
then the escaped `label` fallback. Use `item:*` for shared item defaults and
`icon:*` or `label:*` for generated-region customization; local item values
take precedence. Dock items may be anchors, buttons, divs, or any other direct
element, and there is no standalone DockItem component.

## List

List owns repeated, parent-local `item` parts while preserving unmarked
children in source order. Use ordinary DaisyUI columns when you want complete
layout control:

```html
<ul x-is="list">
    <li class="px-4 text-xs opacity-60">Most played songs</li>

    <li x-part="item">
        <span>01</span>
        <img class="size-10 rounded-box" src="/avatar.webp" alt="">
        <div class="list-col-grow">
            <div>Dio Lupa</div>
            <div class="text-xs opacity-60">Remaining Reason</div>
        </div>
        <p class="list-col-wrap">Long description…</p>
        <button x-is="button" size="sm">Play</button>
    </li>
</ul>
```

Rows without List convenience content stay raw: the component adds
`list-row`, sizing, and spacing to the item host but does not wrap or reorder
its children. Unmarked headers, footers, and separators are left untouched.
Semantic `ul > li` markup is recommended but not required.

A row switches to composed mode when it has a recognized content or accessory
attribute, namespace, or named slot:

```html
<ul x-is="list" size="md" item:heading:class="tracking-tight">
    <li
        x-part="item"
        avatar="/avatar.webp"
        heading="Dio Lupa"
        subheading="Remaining Reason"
        description="Long description"
        badge-end="4:12"
    >
        <button x-is="button" slot="append" size="sm">Play</button>
    </li>
</ul>
```

`heading` resolves from its named slot, then its attribute, then default
content. `subheading` and `description` slots override their attributes.
Composed rows generate a growing main column and use `list-col-wrap` for the
description. `prepend` and `append` slots replace generated conveniences on
their respective side.

Accessory conveniences match Menu: prepend content is ordered `avatar`,
`icon`, `badge`; append content is ordered `icon-end`, `badge-end`. A string
`avatar` becomes its `src`, bare or true `avatar` creates a configurable
placeholder, and false disables it. Use `avatar:*`, accessory namespaces, and
`prepend:*`, `main:*`, `heading:*`, `subheading:*`, `description:*`, or
`append:*` for targeting. Parent namespaces such as `item:heading:*` provide
defaults for every row.

List `size` values `xs` through `xl` inherit into row typography, spacing, and
generated Avatar size; a row-local `size` overrides the parent. The default is
`md`. List does not interpret `value`, `optionable`, `selected`, or `disabled`
and does not synthesize selection ARIA. Use Menu for navigation and
Select/Option for selection.

## Stats

Stats owns repeated, tag-agnostic `stat` parts while preserving unmarked
children in source order. DaisyUI supplies the metric layout and separators;
x-isas supplies optional composition conveniences:

```html
<div x-is="stats" direction="vertical" class="lg:stats-horizontal shadow">
    <section x-part="stat" heading="Downloads"
        description="Jan 1st – Feb 1st" icon="i-tabler-download">
        31K
    </section>

    <div x-part="stat" value="4,200">
        <span slot="heading">New users</span>
        <span slot="description">↗ 400 this month</span>
        <div slot="figure" x-is="avatar" src="/team.jpg"></div>
        <div slot="actions">
            <button x-is="button" size="xs">View users</button>
        </div>
    </div>
</div>
```

`direction="vertical|horizontal"` maps to DaisyUI's matching modifier. A
missing or unknown direction keeps the base horizontal layout, and responsive
classes such as `lg:stats-horizontal` remain ordinary authored classes.

A stat stays raw until it uses `heading`, `value`, `description`, `icon`, a
recognized region slot, or a region namespace. Raw stats retain their exact
authored `.stat-title`, `.stat-value`, `.stat-desc`, `.stat-figure`, and
`.stat-actions` children. In composed mode, regions are generated in figure,
heading, value, description, and actions order.

The `figure` slot wins over `icon`; the icon utility is placed on a nested
element inside `.stat-figure`. Heading and description slots win over their
escaped attributes. Value precedence is its named slot, non-empty default
content, then the escaped `value` attribute. Actions are intentionally
slot-only because they normally contain interactive markup. Empty unresolved
regions are omitted.

Use `stat:*` for defaults shared by every stat and `figure:*`, `icon:*`,
`heading:*`, `value:*`, `description:*`, or `actions:*` for an individual
generated region. Local part attributes extend or override parent defaults.
The native `title` attribute remains a browser tooltip and never becomes the
stat heading.

Stat parts may be sections, articles, divs, or other direct elements. Stats
does not add roles, live-region behavior, colors, sizes, events, or state, and
there is no standalone Stat component. Consumers own metric semantics and any
accessibility behavior appropriate to dynamic updates.

## Progress

Use a wrapper host when progress needs a label, trailing value, or description.
The component generates a native progress bar and keeps ordinary host classes
on the wrapper:

```html
<div
    x-is="progress"
    value="45"
    max="100"
    size="md"
    color="primary"
    label="Uploading"
    description="45 files completed"
    class="w-full"
    bar:aria-label="Upload completion"
>
    <span slot="label-end">45 / 100</span>
</div>
```

`label`, `label-end`, and `description` can each be supplied as an attribute or
a named slot; authored slots win. When `label-end` is absent, determinate
progress shows the rounded percentage. Omitting `value` leaves the native bar
indeterminate and suppresses that automatic percentage.

Use `bar:*` for native progress attributes and presentation such as
`bar:class`, `bar:aria-label`, and `bar:data-*`. For complete control, author
the single declared bar part. Shell `value` and `max` win when present;
otherwise the authored bar values are used:

```html
<div x-is="progress" value="3" max="8" bar:class="rounded-box">
    <progress x-part="bar" aria-label="Import progress"></progress>
</div>
```

For a progress bar without surrounding composition, attach the component
directly to the native element. Label and description APIs are intentionally
not rendered in this form:

```html
<progress
    x-is="progress"
    value="45"
    max="100"
    size="md"
    color="primary"
></progress>
```

Sizes `xs` through `xl` control the bar height and, in wrapper mode, the label
typography and spacing. Colors are `neutral`, `primary`, `secondary`, `accent`,
`info`, `success`, `warning`, and `error`.

## Radial progress

Radial progress uses the correctly spelled `radial-progress` component name:

```html
<div
    x-is="radial-progress"
    value="72"
    max="100"
    size="lg"
    thickness="sm"
    color="info"
></div>
```

It defaults to `value="0"`, `max="100"`, `color="primary"`, and generated
percentage text. An authored default slot replaces the generated text.
`show-value="false"` hides only the generated fallback:

```html
<div x-is="radial-progress" value="72" size="8rem" thickness="0.65rem">
    <strong>72 / 100</strong>
</div>
<div x-is="radial-progress" value="40" show-value="false"></div>
```

`size` and `thickness` accept `xs` through `xl` or arbitrary CSS lengths.
Semantic `color` values color the ring. Setting `background` to a semantic
color instead applies the matching background, content, and border palette and
takes precedence over `color`. The host receives `role="progressbar"`,
percentage-based ARIA values, and DaisyUI's `--value`, `--size`, and
`--thickness` variables.

## Input

Input keeps the element carrying `x-is` as the styled DaisyUI shell and renders
one native input part between optional accessories. Native attributes are always
explicitly scoped:

```html
<label
    x-is="input"
    icon="i-tabler-mail"
    icon-end="i-tabler-check"
    clearable
    native:type="email"
    native:name="email"
    native:placeholder="Work email"
></label>
```

An authored `prepend` or `append` slot replaces `icon` or `icon-end` on that
side. Clear and error actions remain after append content. `clearable` clears
the native value and dispatches bubbling `input` and `change` events from the
native input. Use `clear-action:*`, `clear-icon:*`, and `error-action:*` to
customize the component-owned action elements without replacing their behavior.
The same behavior is available as `$input.clear()`, including for actions that
are not rendered by the component:

```html
<label x-is="input" clearable @keydown.escape.window="$input.clear()"></label>
```

Use `error` as a boolean visual state or as a custom-validity message. A string
message is applied with `setCustomValidity()`, while the error action focuses
the native input and calls `reportValidity()`. `$input.showError()` performs the
same action. `clear()` reports whether it cleared the control, while
`showError()` returns the result of `reportValidity()`. Customize the error
visual with
`error-icon`, `error-icon:*`, or an authored `error-icon` slot:

```html
<label x-is="input" error="Enter a valid email" error-icon:title="Invalid">
    <strong slot="error-icon">!</strong>
</label>
```

For complete native control, author the declared part. Its attributes override
matching `native:*` defaults:

```html
<label x-is="input" icon="i-tabler-mail">
    <input x-part="native" type="email" name="email" wire:model.live="email">
</label>
```

Livewire currently detects `wire:` anywhere in an attribute name, so
`native:wire:model` may be misparsed on the shell. Until that upstream behavior
is fixed, either author the native part as above or use the temporary `lw:`
alias. The alias is translated only on the rendered native input and preserves
modifiers:

```html
<label x-is="input" native:lw:model.live.debounce.250ms="email"></label>
```

`$input` describes the shell; apart from the explicit `clear()` and
`showError()` actions, it does not proxy native value, focus, validity, or
events.

## Input Field

Input Field composes label, control, support, and error regions around Input.
Shorthand generates the canonical stacked structure, while `layout="inline"`
splits metadata from control feedback. Responsive behavior stays with the
consumer and can use the shared `$display` magic:

```html
<div x-is="input-field" id="username-field"
    label="Username" label:append="Optional"
    support="Shown on your profile"
    :layout="$display.mobile ? 'stacked' : 'inline'"
    icon="i-tabler-user" type="text" name="username"></div>
```

Only `stacked` and `inline` are supported, and missing or invalid layout values
fall back to `stacked`. `$display.mobile` follows the globally configured mobile
breakpoint, so applications retain control over when the layout changes.

`size="xs|sm|md|lg|xl"` scales the complete field: the nested Input, label,
support, error, accessories, and layout gaps. Missing or invalid root values
normalize to `md`. A routed `input:size` or an authored Input `size` overrides
only the control while the surrounding regions retain the root field scale:

```html
<div x-is="input-field" size="lg" input:size="xs"
    label="Large metadata" support="The control is intentionally compact"></div>
```

Use direct `x-part="label|control|support|error"` children to control DOM order.
An empty control part generates Input; alternatively it may contain one authored
`x-is="input"` with an authored native part. `native:*` targets the native input,
`input:*` targets the Input shell, and `host:*` targets the field. Alpine and
Livewire bindings stay explicit, for example `native:x-model` or
`native:lw:model`.

The nested Input namespace is available throughout the field as both `$input`
and `$inputField.input`. They are the same stable live proxy, so metadata and
feedback regions may call Input helpers without being nested inside its host:

```html
<div x-is="input-field" error="Required">
    <label x-part="label">Token</label>
    <div x-part="control"></div>
    <small x-part="support">
        <button type="button" @click="$input.clear()">Clear</button>
    </small>
    <small x-part="error">
        <button type="button" @click="$inputField.input.showError()">Show error</button>
    </small>
</div>
```

Plain `id` belongs to the field host and derives an `{id}-control` native ID.
Use `native:id` for an exact control ID. Label `for`, support/error IDs,
`aria-describedby`, and `aria-invalid` are managed while explicit values remain
authoritative.

## Select Field

Select Field applies the same label, control, support, error, layout, and sizing
contract to the styled Select. Direct children are forwarded as Select options
and presentation slots. The visible label also becomes the default Select dialog
title; route `select:label` to override only that title.

```html
<div x-is="select-field" id="owner-field"
    label="Owner" label:append="Required"
    support="Choose the release owner"
    name="owner" required searchable>
    <div x-is="option" value="ada">Ada Lovelace</div>
    <div x-is="option" value="grace">Grace Hopper</div>
</div>
```

Only `stacked` and `inline` layouts are built in. Consumer-owned responsiveness
uses `:layout="$display.mobile ? 'stacked' : 'inline'"`. The root
`size="xs|sm|md|lg|xl"` scales every field region and defaults the nested Select;
`select:size` or an authored Select size changes only the control. Missing or
invalid root sizes normalize to `md`.

Custom composition uses one `x-part="control"`. Leave it empty to generate the
Select, or place exactly one styled `x-is="select"` inside. When an authored
Select is used, its options must live inside it. `select:*`, `control:*`,
`native:*`, `trigger:*`, and `host:*` explicitly target the nested Select,
field control region, hidden form control, visible trigger, and field host.
Use `select:lw:model` as the namespaced Livewire compatibility spelling.

The field owns validation output: the nested styled Select keeps its invalid
trigger styling and validity methods, while its internal message is suppressed
and mirrored into the field error region. Standalone Select remains unchanged.
The nested namespace is exposed as the same stable proxy through `$select` and
`$selectField.select`, including selection, search, validity, and overlay methods.

```html
<div x-is="select-field" error="Choose an owner">
    <label x-part="label">Owner</label>
    <div x-part="control"></div>
    <small x-part="support">
        <button type="button" @click="$select.clear()">Clear</button>
    </small>
    <small x-part="error">
        <button type="button" @click="$selectField.select.showError()">Validate</button>
    </small>
</div>
```

Plain `id` derives an `{id}-control` trigger ID. `trigger:id` targets the visible
button exactly, while `native:id` targets the hidden native Select. Explicit
label targets and ARIA tokens remain authoritative.

## OTP

OTP renders DaisyUI's visual verification-code cells around one native input,
so paste, `autocomplete="one-time-code"`, form validation, and Livewire binding
retain ordinary browser behavior:

```html
<form wire:submit="verify">
    <label
        x-is="otp"
        length="6"
        color="primary"
        auto-submit
        native:name="verification_code"
        native:aria-label="Verification code"
        native:lw:model="code"
        @complete="console.info($event.detail)"
    ></label>
</form>
```

The host must be a `label`. `length` accepts integers from one through eight and
defaults to six. The generated native input defaults to text, numeric input
mode, one-time-code autocomplete, a matching maximum length and digit pattern,
and required validation. Set `required="false"` to opt out. Explicit
`native:*` attributes override those format defaults, including for
alphanumeric codes.

`size` accepts `xs`, `sm`, `md`, `lg`, and `xl`; the standard semantic colors
map to DaisyUI's `otp-{color}` classes. Boolean `joined` connects the cells.
Boolean `invalid` forces error presentation and defaults the native control to
`aria-invalid="true"` without changing its custom validity. Use `cell:*` to
apply attributes to every generated decorative cell.

Every valid native `input` event that reaches the configured length dispatches
a bubbling, composed, cancelable `complete` event with
`detail: { value, length }`. With `auto-submit`, an uncanceled event calls
`requestSubmit()` on the nearest ancestor form. The event still fires without a
form, and mounting or morphing an already-complete value never triggers it.

Author one native part when complete control of its markup is needed:

```html
<label x-is="otp" length="4">
    <input x-part="native" name="pin" inputmode="numeric" wire:model="pin">
</label>
```

## Select and option

Use `x-is="select"` for the styled, accessible composition. It generates one
trigger and one adaptive Overlay while keeping the authored options as its
durable source:

```html
<div
    x-data="{ people: ['ada', 'grace'] }"
    x-is="select"
    x-model="people"
    multiple
    searchable
    label="Project members"
    placeholder="Choose people"
>
    <div x-is="option" value="ada" label="Ada Lovelace" avatar="AL"
        description="Platform"></div>
    <div x-is="option" value="grace" label="Grace Hopper"
        icon="i-tabler-code" keywords="compiler navy"></div>
</div>
```

Use a neutral flow host such as `div`. Hosts such as `ul` are invalid because
the generated trigger and Overlay cannot be children of a list. Options may use
any non-native element; native `select` and `option` cannot contain the
generated markup.

The default trigger uses the DaisyUI Select appearance. `icon`, `prefix`,
`suffix`, and `icon-end` provide quick accessories. The `prepend`, `selection`,
`more`, and `append` slots replace the corresponding presentation. A multiple
Select without `max-selection-shown` renders every selected chip and lets the
trigger wrap to multiple lines. With `max-selection-shown="3"`, the first three
chips are rendered and any remainder is represented by `+N`. A cap of zero
shows only the overflow indicator. Selection presentation never depends on
measured layout dimensions.

A complete `selection` slot owns its output and can iterate
`$select.selectedOptions`; automatic chips and overflow output are omitted:

```html
<div x-is="select" multiple max-selection-shown="3">
    <span slot="selection" class="flex flex-wrap gap-1">
        <template x-for="option in $select.selectedOptions" :key="option.value">
            <span x-is="badge" x-text="option.label"></span>
        </template>
    </span>

    <div x-is="option" value="ada">Ada</div>
    <div x-is="option" value="grace">Grace</div>
</div>
```

Each styled Option reserves an indicator and accepts `avatar`, `icon`, `label`,
`description`, plus `prepend`, `append`, `indicator`, and `selection` slots.
The selected-value representation is resolved in this order:

1. Explicit `<template slot="selection">` markup.
2. `avatar` or `icon` plus `label`.
3. Normalized authored option text.
4. `value`.

Description and append/indicator content are never copied into the trigger. An
explicit selection slot is complete markup and is not wrapped in the default
chip:

```html
<div x-is="option" value="ada" label="Ada Lovelace">
    <span x-is="avatar" size="sm">AL</span>
    Ada Lovelace

    <template slot="selection">
        <strong x-text="$option.label"></strong>
    </template>
</div>
```

`searchable` generates the Input component inside the Overlay. Local filtering
matches label, value, description, and `keywords`. Set `filter="manual"` and
listen for `search` when options come from a server. Put a server-managed
region in exactly one top-level `slot="options"` element:

```html
<div
    x-is="select"
    wire:model="selected"
    multiple
    searchable
    filter="manual"
    @search.debounce.300ms="$wire.$island('people-options').searchPeople($event.detail.query)"
>
    <div slot="options">
        @island(name: 'people-options')
            <div x-is="option" value="ada" label="Ada Lovelace"></div>
        @endisland
    </div>
</div>
```

The wrapper itself is projected into the generated listbox without cloning it.
Parent Select renders preserve the wrapper and skip its children, leaving
replacement, prepend, and append operations to Livewire. Do not provide more
than one `options` wrapper or mix it with default-slot option content. The
generated empty state remains outside the server-owned wrapper.

`mode`, `breakpoint`, and `closedby` are forwarded to Overlay. Dialog
presentation adds a title and close action, and multiple Select adds a Done
footer. These dialog controls are intentionally fixed; advanced dialog
composition uses a headless Select with Overlay directly. Customize the core
regions with `search`, `empty`, and `options` slots. `trigger:*`,
`selection:*`, `chip:*`, `more:*`, `search:*`, `empty:*`, `options:*`,
`listbox:*`, `overlay:*`, and `panel:*` route attributes to generated regions.
In particular, `listbox:class` can opt into a grid without introducing Menu
semantics.

For tile or card choices, keep the styled Select but attach the headless Option.
The attachment supplies state only, so author its interaction and ARIA:

```html
<div x-is="select" listbox:class="grid grid-cols-2 gap-2 p-2">
    <button
        x-as="option"
        value="compact"
        role="option"
        @click="$option.toggle()"
        :aria-selected="$option.selected"
        :class="{ 'ring-2 ring-primary': $option.selected }"
    >
        Compact card
    </button>
</div>
```

Use `x-as="select"` for a completely headless Select. The headless Select and
Option retain the model, durable-record, selection, and search APIs but add no
trigger, Overlay, click behavior, keyboard behavior, or ARIA:

```html
<div x-data="{ users: ['2'] }" x-as="select" x-model="users" multiple>
    <input x-model="$select.query" placeholder="Search users">
    <button x-as="option" value="1" label="Alice"
        x-show="$option.matchesQuery" @click="$option.toggle()">Alice</button>
    <button x-as="option" value="2" label="Bob"
        x-show="$option.matchesQuery" @click="$option.toggle()">Bob</button>
</div>
```

### Select forms and validation

A styled Select generates a synchronized native form control. Put native form
semantics on the Select host; `native:*` may override or extend the generated
control:

```html
<form>
    <div
        x-is="select"
        name="owner"
        required
        label="Release owner"
        placeholder="Choose an owner"
    >
        <div x-is="option" value="ada">Ada</div>
        <div x-is="option" value="grace">Grace</div>
    </div>
    <button type="submit">Save</button>
</form>
```

The control participates in `FormData`, external `form="…"` association,
disabled fieldsets, reset, and native constraint validation. Styled invalid
controls replace the inaccessible hidden-control popup with an inline localized
message and focus the visible trigger. Customize that output with the `error`
slot and `error:*` attributes.

Headless Select remains markup-free. Add an empty native control explicitly
when it should participate in a form:

```html
<div x-as="select" x-model="status">
    <select x-as="select-control" name="status" required></select>
    <button x-as="option" value="draft" @click="$option.select()">Draft</button>
    <button x-as="option" value="released" @click="$option.select()">Released</button>
</div>
```

The authored control retains native invalid UI and can remain visible. When
native `<option>` elements are the option source, attach Select directly to the
native control instead:

```html
<select x-as="select" name="status" required>
    <option x-as="option" value="draft">Draft</option>
    <option x-as="option" value="released">Released</option>
</select>
```

Boolean `error` supplies invalid styling and ARIA. A string also calls
`setCustomValidity()` and displays that message. `$select` exposes
`formControl`, `form`, `validity`, `valid`, `invalid`, `validationMessage`,
`willValidate`, `checkValidity()`, `reportValidity()`, `showError()`, and
`setCustomValidity(message)`.

`$select.value` is scalar for single selection and an array for multiple
selection; `$select.values` is always an array. The namespace exposes
`options`, `selectedOptions`, `visibleSelectedOptions`, `hiddenSelectedCount`,
`selectedIndex`, `length`, `hasSelection`, `selectedCount`, `multiple`,
`disabled`, `query`, `filter`, `open`, and `presentation`. Actions include
`select`, `unselect`, `toggle`, `clear`, `selectAll`, `unselectAll`,
`isSelected`, `option`, `item`, `selectedValues`, `search`, `clearSearch`,
`show`, `hide`, `close`, and `toggleOverlay`. Calling `$select.toggle()` without
a value toggles the Overlay; pass a value to toggle its selection.

`$option` exposes `value`, `label`, `selection`, `selectionCustom`,
`description`, `keywords`, `selected`, `disabled`, `attached`, and
`matchesQuery`, plus `select`, `unselect`, `toggle`, `activate`, `enable`,
`disable`, and `matches(query)`.

Selected records retain their label, generated-or-explicit selection markup,
and metadata while an option is absent. This supports server search,
pagination, and Livewire morphs without losing selected values. Each successful
selection change dispatches one host `input` and one `change`; generated search
events do not reach the Select model listener. `wire:model.live` therefore
updates immediately while an unmodified `wire:model` retains Livewire's normal
deferred behavior. Native form association and constraint validation remain
outside this component.

## Steps

Steps owns repeated parent-local `step` parts while leaving progression state
to consumer markup, Alpine, or Livewire. Use an ordered list for a process and
author every Step as a direct native `li`:

```html
<ol x-is="steps" direction="vertical" class="lg:steps-horizontal">
    <li x-part="step" color="success" icon="i-tabler-check">Register</li>
    <li x-part="step" color="primary" aria-current="step">Choose plan</li>
    <li x-part="step" data-content="!">Purchase</li>
    <li x-part="step">
        <span slot="icon">🚀</span>
        Receive product
    </li>
</ol>
```

`direction="vertical|horizontal"` maps to DaisyUI's direction modifiers. With
no recognized direction, the base `steps` class keeps DaisyUI's horizontal
layout. Responsive modifiers remain ordinary authored classes. Each step maps
`neutral`, `primary`, `secondary`, `accent`, `info`, `success`, `warning`, and
`error` to the corresponding `step-{color}` class.

Uncomposed steps retain their exact authored children, so native
`data-content` and a direct raw `.step-icon` work unchanged. `icon` enables the
convenience renderer and creates an icon element inside the required direct
`.step-icon` marker; keeping those elements separate avoids conflicts with
Tailwind CSS icon utilities. An `icon` slot wins over its shorthand and may
contain arbitrary markup. Authored default content wins over the escaped
`label` fallback. Use `step:*` for defaults shared by all parts and `icon:*` or
`label:*` on an individual step for its generated regions. A step's local
attributes override parent defaults.

Steps does not infer a current index, completion, colors, or accessibility
state. Set per-step presentation explicitly and put `aria-current="step"` on
the current item. There is no standalone `step` component or Steps-specific
Alpine API.

## Tabs

Tabs progressively add selection behavior only when panels exist. Without a
local or linked panel host, `x-is="tabs"` is presentation-only: links and native
radio groups keep their authored behavior while the DaisyUI adapter supplies
`tabs`, `tab`, and active/disabled presentation.

Colocated panels use DaisyUI's adjacent structure. Names may be omitted in this
form unless the Tabs host uses `x-model`:

```html
<div x-data="{ section: 'overview' }">
    <div x-is="tabs" x-model="section" variant="lift" aria-label="Account">
        <button x-part="tab" name="overview">Overview</button>
        <section x-part="tab-content" name="overview">Overview content</section>

        <button x-part="tab" name="security">Security</button>
        <section x-part="tab-content" name="security">Security content</section>
    </div>
</div>
```

Every non-void tab control can add leading and trailing conveniences without
replacing its authored label. Accessories render as `icon`, `badge`, authored
content, `icon-end`, then `badge-end`:

```html
<div x-is="tabs" id="inbox-tabs" value="inbox" variant="box">
    <button x-part="tab" name="inbox"
        icon="i-tabler-inbox" badge="New" badge:color="info"
        icon-end="i-tabler-chevron-right" badge-end="12"
        badge-end:variant="soft">
        Inbox
    </button>
</div>
```

Use `icon:*`, `badge:*`, `icon-end:*`, and `badge-end:*` to customize the
generated elements. Badges are generated through the registered Badge
component and default to `size="sm"`. `prepend:*` and `append:*` customize the
side wrappers, while parent `tab:*` defaults continue to apply to every tab.
An authored `slot="prepend"` or `slot="append"` replaces all shorthands on
that side and may contain arbitrary markup. Tabs without accessories retain
their exact authored children. Because void elements cannot contain generated
regions, accessory attributes and prepend/append slots are rejected on
`<input x-part="tab">`; native radio tabs without accessories remain passive.

Controls and panels can live in separate DOM locations. The Tabs host requires
a unique `id`, and every linked tab and panel requires a matching unique
`name`. Several panel hosts may link to one Tabs host; a name may occur once in
each panel host, and selecting it reveals every matching panel:

```html
<div x-is="tabs" id="account-tabs" value="overview" variant="box">
    <button x-part="tab" name="overview">Overview</button>
    <button x-part="tab" name="security">Security</button>
</div>

<main x-is="tab-panels" controlled-by-tabs="account-tabs">
    <section x-part="tab-content" name="overview">Overview content</section>
    <section x-part="tab-content" name="security">Security content</section>
</main>
```

`tab-panels` is also attachable when another component owns the structural
host. Attach its panels functionally because `x-as` does not own `x-part`:

```html
<main x-is="card" x-as="tab-panels" controlled-by-tabs="account-tabs">
    <section x-as="tab-content" name="overview">Overview content</section>
    <section x-as="tab-content" name="security">Security content</section>
</main>
```

`controlled-by-tabs` implicitly attaches `tab-panels` when it appears on a
different `x-is` host, matching other activation attributes. On a plain host,
declare `x-as="tab-panels"` explicitly.

Managed tabs implement roving focus and the tablist/tab/tabpanel ARIA pattern.
Automatic activation is the default; `activation="manual"` makes arrows,
Home, and End move focus while Enter or Space selects. An authored vertical
`aria-orientation` switches keyboard navigation to Up and Down. Disabled tabs
are skipped. Managed radio inputs are rejected because their native group
`name` conflicts with the tab identity contract.

`$tabs` and `$tabPanels` share writable `value`, selection methods
`select()`, `next()`, `previous()`, `first()`, and `last()`, and derived
`previousValue`, indices, `direction`, `managed`, and `linked` state. They also
provide `isSelected(name)` and `position(name)`. Direction is
`next|previous|none`; tab and panel hosts receive `data-isas-tab-state` and
`data-isas-tab-position="before|active|after"`. A functional `$tabContent`
scope exposes its `name`, `active`, `previous`, `position`, `linked`, and
controlling `tabs` element.

Inactive panels receive `hidden` by default. Set `visibility="manual"` on the
panel-owning Tabs or TabPanels host to retain ARIA and direction annotations
while consumer bindings own visibility and transitions:

```html
<div x-as="tab-panels" controlled-by-tabs="account-tabs" visibility="manual">
    <section x-as="tab-content" name="overview"
        x-show="$tabContent.active" x-transition>
        Overview content
    </section>
</div>
```

Selection dispatches bubbling `input` and `change` events on Tabs. Every
effective change also dispatches `tabchange` on Tabs and linked panel hosts
with `value`, `previousValue`, indices, `direction`, and the interaction
`source`. DaisyUI presentation accepts `variant="box|border|lift"`,
`placement="top|bottom"`, and `size="xs|sm|md|lg|xl"`.

## Timeline

Timeline owns repeated direct `li` item parts. Each composed item generates
its start, middle, and end regions plus the boundary connectors required by
DaisyUI:

```html
<ul x-is="timeline" direction="vertical" compact>
    <li x-part="item" start="1984" icon="i-tabler-check"
        box="end" after:class="bg-primary">
        First Macintosh
    </li>

    <li x-part="item" box="start">
        <article slot="start">The iMac arrives</article>
        <time slot="end" datetime="1998">1998</time>
        <span slot="middle"><span class="i-tabler-apple"></span></span>
    </li>
</ul>
```

`direction="vertical|horizontal"`, boolean `compact`, and boolean
`snap-icon` map to the matching DaisyUI modifiers. Missing or unknown
directions use the base horizontal layout, while authored responsive classes
such as `md:timeline-horizontal` remain composable.

An item remains raw until it uses a start, middle, end, icon, box, connector,
slot, or region namespace. Raw items retain exact authored
`.timeline-start`, `.timeline-middle`, `.timeline-end`, `.timeline-box`, and
direct `hr` markup. In composed mode, start and middle slots win over their
escaped attributes, the middle attribute wins over `icon`, and the end slot
wins over the escaped end attribute and default-content fallback. Icon classes
are placed on a nested element inside `.timeline-middle`.

`box="start|end|both|none"` applies `timeline-box` to generated regions.
Connectors default to `auto`: the first item receives an after connector,
middle items receive both, the last receives before, and a single item has
none. Use `connector="before|after|both|none"` to override that structure.
`item:*` provides shared defaults; `before:*`, `start:*`, `middle:*`,
`icon:*`, `end:*`, and `after:*` customize the generated nodes.

Timeline requires item parts to use `li`, but does not enforce the host tag.
It does not infer progression, colors, events, or ARIA, and it has no
standalone TimelineItem component.

## Menu

Menu owns repeated parent-local `item` parts while preserving other authored
children in source order. Its adapter adds `menu`, maps `xs` through `xl` to
DaisyUI size classes, and maps `variant="horizontal"` to `menu-horizontal`.

Use `x-part="item"` on direct children. The authored item host is permanent; a
native `li` is recommended because DaisyUI's menu selectors target list items.
The parent Menu adapter adds the stable `menu-item` hook per occurrence. It
puts `menu-title` on heading hosts, `menu-disabled` on disabled hosts, and
`menu-active` on the generated content element:

```html
<ul x-is="menu" size="sm">
    <li x-part="item" heading="Workspace"></li>
    <li x-part="item" label="Inbox" icon="i-tabler-inbox" badge-end="3" active></li>
    <li x-part="item" href="/settings" icon="i-tabler-settings">Settings</li>

    <li x-part="item" label="Projects" collapsible open>
        <ul x-is="menu" slot="submenu">
            <li x-part="item" label="Active projects"></li>
        </ul>
    </li>
</ul>
```

With a submenu, `collapsible` renders `details > summary` and places the named
submenu after the summary. Otherwise a truthy `heading` renders `h2`, an
`href` renders `a`, and the default is `button type="button"`. Non-empty
authored content wins over a string-valued `heading`, which wins over `label`.
Plain `title` retains its standard HTML tooltip meaning.

Menu items support `icon`, `icon-end`, `badge`, `badge-end`, and `avatar`.
Generated prepend content is ordered avatar, icon, badge; append content is
ordered icon-end, badge-end. These conveniences are promoted into prepared
slots as real Badge and Avatar components, so their registered adapters and
custom renderers remain authoritative. `badge:*`, `badge-end:*`, and `avatar:*`
attributes are forwarded to those nested components.
The `avatar` string becomes the nested Avatar's `src`; use an authored prepend
Avatar for initials or other custom content. An authored `prepend` or `append`
slot replaces the conveniences on that side. Use `content:*`, `label:*`, `prepend:*`,
`append:*`, accessory namespaces, `details:*`, and `submenu:*` to address
generated parts. Custom adapter renderers receive prepared accessory and
submenu slots plus `view.mode`, `view.contentTag`, `view.contentSource`,
`view.hasSubmenu`, `view.collapsible`, `view.heading`, and `view.disabled` on
each prepared item occurrence in `parts`.
Component-host namespaces such as `item:content:*` provide defaults for every
item, while attributes such as `content:*` on an item affect only that
occurrence.

Menu items are parent-local parts and must be direct children of Menu. They are
not registered as standalone `x-is` components. This keeps the item contract,
adapter customization, and reconciliation owned by Menu.

## Extension API

```js
import { Component, Isas } from 'x-isas'

class Notice extends Component {
    prepareRender({ attrs }) {
        return { emphasized: attrs.boolean('emphasized') }
    }

    render() {
        const className = this.view.emphasized ? 'font-bold' : ''
        return `<strong class="${className}">${this.slots.get('default').html()}</strong>`
    }
}

class Trackable extends Component {
    static attachable = true

    mount() {
        this.listen(this.el, 'click', () => console.log('clicked'))
    }

    mergeScope() {
        return { tracking: true }
    }
}

Isas.components.register('notice', Notice)
Isas.components.register('trackable', Trackable)
Isas.adapters.register('notice', ({ attrs }) => ({
    host: { class: attrs.get('tone') === 'warning' ? 'notice-warning' : 'notice' },
    parts: { icon: { class: 'notice-icon' } },
}))
```

Components receive `mode`, frozen `config`, `attrs`, `slots`, `parts`, and the
canonical `source`. Attachments receive cloned canonical attributes and slots
before `mount()` and on source changes. Primary components additionally run
the structural render pipeline. `prepareRender({ attrs, slots, parts })` runs
after adapter part attributes are merged and returns the renderer-facing
value exposed as `component.view`. Adapter part attributes are merged into
namespaced attributes such as `icon:class` before component preparation and
rendering.

Low-level surface extensions may build on the exported `TargetComponent`,
`TargetController`, and `targetRegistry`. The registry's subscription API is
the supported linkage mechanism for custom targets and triggers.

Components that generate nested `x-is` hosts should give each one a stable key
with `generatedComponentAttributes()`:

```js
import { generatedComponentAttributes } from 'x-isas'

const badgeAttrs = attrs.for('badge').merge({
    'x-is': 'badge',
    ...generatedComponentAttributes('notice:badge'),
})
```

Generated component runtimes are reconciled from their parent's render target,
excluded from authored-descendant matching, and cleaned up when their keyed
node is removed. Their generated source never becomes part of the parent's
canonical authored snapshot.

Run `npm test` and `npm run build` from this directory. Package-owned browser
fixtures are available through `npm run test:browser` and
`npm run test:livewire`; neither suite imports from a containing application.

While the package is under active development, deferred compatibility work and
pre-release API decisions are tracked in
[DEVELOPMENT_NOTES.md](./DEVELOPMENT_NOTES.md). Review that checklist before
stabilizing the native surface components or publishing the package.
