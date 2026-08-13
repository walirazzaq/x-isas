# Development notes

This file records implementation details that are acceptable while `x-isas` is
under active development but must be reconsidered before its public API and
browser-support contract are finalized.

## Native surface follow-up

The attribute-linked `dropdown`, `dialog`, and `overlay` implementation uses
authored targets, functional triggers, a per-document target registry, and one
shared target controller. It does not retain the earlier generated-shell or
content-rehosting design: surface targets and their descendants are not
generated, cloned, moved, serialized, or passed through manual Alpine tree
destruction and initialization.

The current architecture is considered suitable for continued development.
Review the following items before release.

### Registry events and public API

- Target linkage currently uses registry subscriptions.
- The unused `x-isas:target-ready` and `x-isas:target-unavailable` DOM events
  were removed. Registry subscriptions are the linkage mechanism.
- `TargetComponent`, `TargetController`, and `targetRegistry` remain exported
  from the core entry as low-level surface extension points.

### Controller cleanup

- Keep the shared controller focused on browser behavior and state transitions.
  Component configuration and adapter presentation should continue to remain
  outside it.

### Compatibility behavior

- The no-Popover fallback can show and hide a target, but dropdown and
  non-dialog overlay fallbacks do not yet implement complete Escape and
  outside-pointer dismissal.
- Native dialogs and DaisyUI currently provide scroll locking in the supported
  browsers. The previously discussed reference-counted scroll-lock
  fallback, including duplicate-lock detection, has not been implemented.
- The missing-accessible-name warning runs during initial mounting. An adaptive
  overlay that initially renders as a dropdown and later changes to dialog
  presentation should also be checked.
- Native `<dialog>` close requests remain the mechanism for platform Back or
  dismiss gestures. Compatibility fallbacks must not claim hardware-Back
  support and must never add session-history sentinels.

### Floating UI loading

Dropdown positioning requests Floating UI through a dynamic import when the
surface opens. Tooltip currently imports Floating UI statically, so the
production build includes the library eagerly and reports that the dynamic
import cannot create a separate chunk. Decide before release whether package
level lazy loading is required. If it is, align tooltip and surface imports;
otherwise simplify the loading strategy and document the bundle behavior.

### Release review

Before declaring the surface API stable:

1. Resolve or explicitly accept every item above.
2. Confirm that the low-level surface extension exports match the intended
   public API.
3. Add coverage for any retained compatibility branches.
4. Run package tests and production builds.
5. Run Laravel and Playwright acceptance tests against the configured Laragon
   endpoint.
6. Perform the documented real-device Android Back smoke test when a reachable
   device environment is available.

At the time this note was last reviewed, all 298 package tests and the
production build passed. The build emitted only the expected Floating UI mixed
static/dynamic-import warning described above.
