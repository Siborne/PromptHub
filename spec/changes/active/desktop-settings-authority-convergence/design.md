# Desktop Settings Authority Convergence Design

<!-- traceability: enforced -->

## `DES-CONFIG-001`: Physical Ownership

The active PromptHub root owns one versioned configuration plane:

| State class                        | Canonical owner                                          | Notes                                                                                                       |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| General app/user preferences       | `config/app.json`                                        | Includes language, appearance, editing, updates, durable layout, startup/window behavior, and `closeAction` |
| Provider/model metadata and routes | `config/providers.json`                                  | `config/ai-models.json` remains a redacted compatibility projection                                         |
| Non-secret sync configuration      | `config/sync-providers.json`                             | Credentials are references into the vault                                                                   |
| Marketplace sources                | `config/marketplace-sources.json`                        | Stable IDs and deterministic ordering                                                                       |
| Renderer device identity           | `config/devices/renderer.json`                           | Device-local; not automatically portable                                                                    |
| Agent definitions and device paths | `config/devices/agents.json`                             | Device-local paths and overrides                                                                            |
| Recovery paths                     | `config/recovery-paths.json`                             | Validated local paths; excluded from portable export                                                        |
| Credentials and tokens             | `secrets/vault.enc` or OS facility                       | Config stores references only                                                                               |
| Transient UI/session state         | renderer memory, bounded LocalStorage, or SessionStorage | Never required to survive database or browser-state loss                                                    |
| Desktop SQLite `settings`          | frozen legacy migration source                           | No post-marker precedence or normal write path                                                              |
| Web/SaaS `user_settings`           | server database                                          | Separate authenticated product boundary                                                                     |

`packages/shared` owns typed setting/patch contracts. `packages/core` owns the
schema policy, document routing, converters, and atomic configuration
repository. Electron main owns the repository instance, encryption adapter,
runtime application, and IPC. Renderer owns only UI projections and actions.

## `DES-CONFIG-002`: Field Classification Registry

Replace disconnected allowlists with one typed registry entry per field:

```text
key
document
schema/default/normalizer
durability: durable | transient | derived
scope: device | portable | syncable
secret: none | reference | secret
backup: safety-point | portable-redacted | excluded
apply: startup-main | startup-renderer | live-main | live-renderer
```

Derived values such as calculated dark-mode state are not serialized as
authoritative settings. Incidental UI state does not enter the registry.
Explicit layout choices currently duplicated in LocalStorage become canonical
preferences; LocalStorage may cache the last committed projection but cannot
override it.

## `DES-CONFIG-003`: Read, Patch, And Startup Flow

Startup order is fixed:

1. bind one runtime root and recover an interrupted config publication;
2. read and validate the canonical snapshot;
3. if no completion marker exists, collect allowlisted legacy candidates and
   publish one verified canonical snapshot;
4. apply main-owned settings such as proxy, startup, window, update, and close
   behavior from that snapshot;
5. expose the same typed snapshot through preload/IPC;
6. hydrate renderer projections without writing defaults back during startup;
7. open the user-facing runtime only after required settings are applied.

Mutation order is also fixed:

1. renderer sends a typed patch and expected revision/digest;
2. main/Core serializes writers and merges against the latest snapshot;
3. schema validation and secret extraction run before publication;
4. affected documents publish through one stage/journal boundary and are read
   back for verification;
5. main applies the committed value and returns the committed snapshot;
6. renderer replaces its projection; rejection restores the prior projection
   and exposes an actionable error.

No action may claim durability from an unawaited Zustand subscription.

## `DES-CONFIG-004`: Migration And Retirement

Migration precedence applies only while the marker is absent:

1. a valid existing canonical field;
2. a valid explicit legacy renderer value for historically renderer-owned
   fields;
3. a valid domain-specific legacy file or SQLite value for a missing field;
4. the registered default.

Timestamps from unrelated stores do not establish authority. Migration writes
one canonical snapshot, verifies it after restart, records the durable marker,
then redacts/removes legacy renderer values. SQLite `settings` rows remain
read-only for a bounded downgrade window and are excluded from all current
reads/writes. Their later schema removal is a separate reversible migration.

The current remembered-close implementation may dual-write the compatibility
row until this change migrates its remaining startup consumers. That bridge is
not the final contract.

## `DES-CONFIG-005`: Backup, Rebuild, And Performance

- Database rebuild stages/replaces `data/prompthub.db` and never mutates
  `config/` or `secrets/`.
- Same-device upgrade safety points include validated config and only
  device-bound encrypted vault bytes allowed by the existing secret policy.
- Portable export includes only fields with `portable` policy and redacts
  secret/device/path values.
- Settings restore stages a complete configuration snapshot and rolls back all
  documents on any failure; it does not delete current settings first.
- Config reads/writes are `O(S)` over bounded documents. A serialized writer
  prevents lost updates; transient high-frequency state remains outside config
  to avoid excessive file I/O.

## Verification

- `TEST-CONFIG-001`: delete/rebuild SQLite, clear renderer storage, and restart
  twice; every canonical setting remains unchanged.
- `TEST-CONFIG-002`: exercise every registry classification and reject unknown,
  derived, unbounded, malformed, secret-leaking, or incorrectly scoped fields.
- `TEST-CONFIG-003`: inject failure at validation, stage, document/vault
  publication, fsync, reload, main apply, and renderer acknowledgement; no
  partial snapshot becomes visible.
- `TEST-CONFIG-004`: run concurrent disjoint and conflicting patches against
  revision/digest control; no field is silently lost.
- `TEST-CONFIG-005`: migrate historical LocalStorage/SQLite/config conflicts,
  verify precedence once, then prove legacy stores cannot override the marker.
- `TEST-CONFIG-006`: export/restore and upgrade-snapshot fixtures prove portable
  allowlisting, secret redaction, rollback, downgrade, and unknown-newer safety.
- `TEST-CONFIG-007`: measure large bounded inventories and repeated patches;
  memory remains `O(S)`, writer concurrency is one, and transient UI actions do
  not produce config I/O.

## Analyze Result

- Requirement links: `FR-CONFIG-001..005`, `NFR-CONFIG-001` are covered.
- Verification links: `TEST-CONFIG-001..007` cover authority, migration,
  failure, concurrency, security, backup, restart, and performance.
- Resolved conflict: older stable text broadly placed UI preferences in
  LocalStorage. The user decision refines this to explicit durable preferences
  in config and only incidental transient UI/session state in renderer storage.
- Current implementation conflict: `APP_SETTING_KEYS`, SQLite `settings`,
  `DESKTOP_RENDERER_PREFERENCE_FIELDS`, and main memory overlap. This is the
  implementation target, not an alternate accepted authority.
- Blocking conflicts: none for entering implementation after the complete key
  inventory is recorded.
- Unresolved `[待确认]`: none.

## Traceability

| Requirement      | Design                             | Verification                         | Task                           |
| ---------------- | ---------------------------------- | ------------------------------------ | ------------------------------ |
| `FR-CONFIG-001`  | `DES-CONFIG-001`, `DES-CONFIG-003` | `TEST-CONFIG-001`, `TEST-CONFIG-003` | `T-CONFIG-001`, `T-CONFIG-004` |
| `FR-CONFIG-002`  | `DES-CONFIG-002`                   | `TEST-CONFIG-002`                    | `T-CONFIG-002`                 |
| `FR-CONFIG-003`  | `DES-CONFIG-003`                   | `TEST-CONFIG-003`, `TEST-CONFIG-004` | `T-CONFIG-003`, `T-CONFIG-004` |
| `FR-CONFIG-004`  | `DES-CONFIG-003`, `DES-CONFIG-004` | `TEST-CONFIG-001`, `TEST-CONFIG-005` | `T-CONFIG-005`                 |
| `FR-CONFIG-005`  | `DES-CONFIG-001`, `DES-CONFIG-005` | `TEST-CONFIG-006`                    | `T-CONFIG-006`                 |
| `NFR-CONFIG-001` | `DES-CONFIG-003`, `DES-CONFIG-005` | `TEST-CONFIG-003`, `TEST-CONFIG-007` | `T-CONFIG-004`, `T-CONFIG-007` |
