# Design

<!-- traceability: enforced -->

## Current Boundary And Root Cause

`LOCAL_PLUGIN_MARKER_PATHS` already lists Codex, Claude, Cursor, Gemini, Kiro,
and Copilot marker paths. `findLocalPluginMarker()` stops at the first existing
path, and that single path is reused for identity, inventory, validation, and
source reconciliation. Codex appears first.

`canPassthroughNativePluginPackage()` independently hard-codes
`targetId === "codex"`. The static target matrix labels Claude as Adapter even
when the selected package already includes a valid Claude-native marker.

Package files remain the source of truth. The library can cache derived
evidence for display, but distribution must revalidate the selected target
marker immediately before writing.

## `DES-PLUG190-001`: Multi-marker evidence model

Replace singular discovery with an allowlist-based inspector:

```text
inspectLocalPluginMarkers(packagePath) -> {
  canonicalManifest,
  targets: [
    { targetId, relativeMarkerPath, status, warningCode? }
  ]
}
```

Marker-to-target mapping is explicit and one-to-one for enabled native/adapter
targets. Discovery performs a fixed number of `lstat`/existence checks and
validates:

- marker remains within the package after realpath resolution;
- marker is a regular bounded file, not an escaping symlink;
- JSON or `POWER.md` shape parses under the target-specific parser;
- referenced child paths remain inside the package.

Canonical package identity continues to use the first valid manifest according
to the existing stable priority. Per-target evidence does not merge manifest
names or versions into the canonical identity.

Optional derived evidence may be stored in `PluginLibraryEntry` so list/detail
views do not rescan on every render. Source install, refresh, update, rollback,
and health check refresh it. The field is backward-compatible and can be
reconstructed from the managed package; it is not an independent truth source.

## `DES-PLUG190-002`: Selected-package target overlay

Keep the static matrix as the platform capability baseline, then overlay
selected-package evidence:

- valid exact marker: `native`;
- no exact marker on an enabled adapter target: `adapter`;
- invalid exact marker: disabled for that Plugin with an actionable warning;
- unsupported static target: retain its existing disabled status.

For batch distribution, aggregate per target:

- `native` only when every selected Plugin is native for that target;
- `adapter` when at least one selected Plugin requires generation and none is
  invalid;
- disabled when any selected Plugin has an invalid exact marker, with the
  affected Plugin names in bounded detail.

This avoids a global matrix falsely describing every Plugin the same way.

## `DES-PLUG190-003`: Generalized native passthrough

At distribution time, inspect the selected Plugin's current managed package.
If the exact target marker is valid, use the existing whole-package
copy/symlink path and preserve the marker. If the marker is absent and the
target has an enabled adapter, use the current copy-plus-generated-marker path.

If an exact marker exists but is invalid, stop with a target-specific error.
Do not delete or replace it with a generated marker.

The existing safe target-path validation, overwrite cleanup, and package
boundary checks remain mandatory. Native passthrough does not mean skipping
static package validation.

## `DES-PLUG190-004`: Compatibility and update behavior

Existing library records without native-target evidence are inspected lazily
on first target/detail request and updated during the next library mutation.
No JSON library version bump is required for an optional derived field.

Source refresh/update and version rollback recalculate evidence from the
resulting package. Snapshot restore may accept old cached evidence but must
recalculate it before distribution. This prevents a stale cache from
authorizing passthrough after local file changes.

## Test-First Design

The first red fixture creates one real temporary package with both Codex and
Claude native manifests. Against current code, only Codex is discovered and a
Claude distribution rewrites the package through the adapter path.

Required methods:

- black-box lifecycle: import, target matrix, distribute, update, rescan,
  rollback;
- white-box branches: valid, absent, malformed, escaping symlink, target
  disabled, mixed batch;
- filesystem integration: compare original and distributed native manifest
  bytes and package fingerprints;
- failure/rollback: invalid target marker causes no target replacement and no
  `distributedTargetIds` mutation;
- performance: count only fixed allowlist marker probes on a large fixture;
- security: traversal, null byte, oversized marker, and symlink escape.

## Affected Areas

- `packages/core/src/plugin-library` marker validation, reconciliation,
  target overlay, and distribution
- Optional shared Plugin evidence/result types
- Plugin IPC/preload only if selected-plugin matrix input is added
- Desktop target picker/list presentation and focused fixtures
- No SQLite schema; local Plugin library JSON stays version 1

## Failure And Rollback

- External boundary: managed Plugin package read and Agent target write.
- Partial failure behavior: validation completes before target removal; a
  target write failure does not record distribution success.
- Recovery/rollback: existing target replacement follows the current safe
  distribution cleanup path; source My Plugins package is never mutated.

## Analyze Result

- Requirement links: stable Plugin docs already distinguish native packages
  from generated adapters.
- Verification links: each marker, overlay, passthrough, cache, and failure
  branch maps to `TEST-PLUG190-*`.
- Blocking conflicts: none. Static platform support remains a baseline; the
  selected package supplies native evidence.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement       | Design                                                  | Verification                           | Task                                              |
| ----------------- | ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `FR-PLUG190-001`  | `DES-PLUG190-001`, `DES-PLUG190-002`, `DES-PLUG190-004` | `TEST-PLUG190-001`, `TEST-PLUG190-004` | `T-PLUG190-001`, `T-PLUG190-002`, `T-PLUG190-005` |
| `FR-PLUG190-002`  | `DES-PLUG190-003`                                       | `TEST-PLUG190-002`                     | `T-PLUG190-003`                                   |
| `FR-PLUG190-003`  | `DES-PLUG190-001`, `DES-PLUG190-003`                    | `TEST-PLUG190-003`                     | `T-PLUG190-004`                                   |
| `NFR-PLUG190-001` | `DES-PLUG190-001`                                       | `TEST-PLUG190-005`                     | `T-PLUG190-006`                                   |
