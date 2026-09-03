# ADR-20260820-001: Desktop Settings Authority

## Status

Accepted on 2026-08-20. The decision is authoritative; implementation is
tracked by `desktop-settings-authority-convergence` and is not yet complete.

## Context

Desktop settings currently cross four state holders: versioned files under
`config/`, the SQLite `settings` compatibility table, renderer LocalStorage,
and Electron main-process memory. A user choice can therefore be accepted by
one holder but missed by startup, database rebuild, renderer cleanup, or an
immediate process exit. The remembered close action exposed this split, but the
same risk applies to every explicit setting and user preference.

The storage authority ADR already assigns non-secret application configuration
to `config/` and makes local SQLite rebuildable. This decision refines that rule
for settings so later fixes do not choose ownership one field at a time.

## Decision

1. Versioned documents below `<PromptHubRoot>/config/` are the sole durable
   authority for Desktop non-secret settings and explicit user preferences.
2. `config/app.json` owns general application and user preferences, including
   appearance, language, editing behavior, update preferences, startup/window
   behavior, `closeAction`, durable layout choices, and other allowlisted
   settings that the product promises to remember.
3. Existing domain documents continue to own their settings:
   `config/providers.json`, `config/sync-providers.json`,
   `config/marketplace-sources.json`, `config/devices/renderer.json`,
   `config/devices/agents.json`, and `config/recovery-paths.json`.
   `config/ai-models.json` remains a redacted compatibility projection, not an
   authority.
4. Credentials, tokens, and secret-bearing fields are referenced from config
   but owned by the encrypted device-bound vault or an OS security facility.
5. Renderer LocalStorage and Zustand are a UI cache/projection only. They may
   retain bounded transient navigation state, drafts, selections, or filters
   that the product explicitly permits to reset. An explicit user setting is
   not allowed to rely on LocalStorage for durability.
6. The Desktop SQLite `settings` table is a legacy migration/compatibility
   source only. After canonical migration completes, current code must not use
   it for precedence, durable writes, or normal startup. It may remain frozen
   for a bounded downgrade window before a later schema migration retires it.
   Server-side `user_settings` remains database-authoritative within the
   authenticated Web/SaaS boundary and is not changed by this decision.
7. Electron main process owns the configuration service. Renderer actions send
   typed patches through preload/IPC; success is returned only after schema
   validation and atomic canonical publication. Main-process memory and the
   renderer projection update from the committed snapshot, not as competing
   authorities.
8. Database rebuild, renderer storage clearing, and a second application launch
   must preserve every canonical setting. Backup/export/sync inclusion is a
   separate per-field scope policy; durable does not automatically mean
   cross-device portable.

## Alternatives

| Option                                                  | Benefits                                                                                    | Costs/Risks                                                                                                                           | Decision |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SQLite owns all Desktop settings                        | One transactional store                                                                     | A catalog rebuild becomes data recovery; renderer/main startup still needs a projection; conflicts with accepted file-first authority | Rejected |
| Continue dual-writing config, SQLite, and LocalStorage  | Easiest short-term compatibility                                                            | No deterministic precedence, partial success, repeated field-specific bugs                                                            | Rejected |
| LocalStorage owns renderer preferences                  | Simple React persistence                                                                    | Browser cleanup and origin changes lose explicit preferences; main cannot safely initialize before renderer                           | Rejected |
| Versioned config authority with DB/renderer projections | Survives catalog rebuild, is inspectable and recoverable, and gives main one startup source | Requires a staged migration and retirement of legacy reads/writes                                                                     | Accepted |

## Consequences

- Positive: deleting and rebuilding `prompthub.db` cannot erase Desktop
  settings or explicit preferences.
- Positive: startup, backup, restore, and failure handling have one typed
  configuration snapshot.
- Positive: renderer cache can be cleared without losing durable product state.
- Cost: current settings actions, startup consumers, snapshot paths, and tests
  must migrate to one main/Core configuration service.
- Negative: whole-document config publication is `O(S)` in the bounded settings
  payload; writes must be serialized and coalesced rather than used for
  high-frequency transient UI state.
- Compatibility/migration: valid canonical config wins. Before the migration
  marker exists, a valid explicit renderer value wins for historically
  renderer-owned keys, SQLite supplies only missing legacy values, and defaults
  apply last. After verified publication, legacy stores cannot override config.
- Verification: failure injection, concurrent patching, database deletion and
  rebuild, LocalStorage clearing, first/second restart, downgrade, backup,
  restore, and secret-redaction fixtures are required.

## Links

- Requirement:
  `spec/changes/active/desktop-settings-authority-convergence/specs/desktop-settings/spec.md`
- Change: `spec/changes/active/desktop-settings-authority-convergence/`
- Issue: none
- Refines: `spec/adr/ADR-20260811-001-storage-authority-and-evolution.md`
