# Agent Provider Tray Designs

## `DES-AGENT-048`: Verified Provider Projection And Quick Switch

The system tray reuses the main-process Provider runtime that already owns
Provider Profile reads, adapter registration, native preview, activation,
verification, rollback and audit snapshots. IPC registration and the tray must
receive the same runtime instance after startup and after database restore.
Neither surface may construct a durable active-provider cache.

The tray projection is bounded by the fixed provider-adapter registry:

1. Read active public Provider Profiles through
   `AgentProviderProfileService`.
2. Group at most the registered platform set in canonical registry order.
3. Read the latest verified snapshot for each represented platform.
4. Re-run native preview for that snapshot/Profile pair.
5. Mark it current only when platform, Profile, native digest and a
   no-review `preserve` plan still agree.

This makes refresh `O(P + A * F)`, where `P` is the Profile count, `A` is the
fixed supported adapter count and `F` is one adapter's bounded native config
read. The loop is sequential to avoid unbounded filesystem fan-out. A failed
or stale native read removes the current marker instead of trusting the old
snapshot. Profile names and non-secret model mappings may appear in the menu;
secret references, credentials, native paths, snapshots and config values may
not.

Selecting an alternate Profile executes:

`preview -> native confirmation -> activate -> verify/rollback -> refresh`

The click handler passes the preview digest to the same
`AgentProviderActivationService` used by the workspace. A `preserve` plan is a
no-op. Any conflict, external modification, blocked field or unsupported
decision opens the Agent workspace for the full review flow. Failed activation
shows only a stable localized outcome and never embeds native errors or secret
material. The tray cache is presentation-only, invalidated on database
runtime replacement, and ignored after tray destruction.

### Failure And Lifecycle Rules

- Provider list refresh failure retains the prior menu and logs one generic
  message without the underlying error.
- Repeated loads use a generation token; late results after a newer load or
  tray destruction are ignored.
- A confirmed activation still uses the existing per-platform in-flight lock,
  encrypted backup, atomic write, semantic reread, verification and rollback.
- Success reloads the tray from SQLite plus native preview. Cancellation and
  already-active results create no extra dialog or write.
- The Agent workspace remains the repair surface; the tray does not add field
  conflict resolution or credential editing.

## `DES-AGENT-050`: Shared Verified Current Profile Projection

The Provider workspace adopts CC Switch's useful current-Provider affordance
without copying its React/Tauri implementation or treating a stored selected
id as current truth. The existing main-process Provider projection service
adds one per-platform query that reuses the exact `DES-AGENT-048` algorithm:
latest verified snapshot plus a fresh native preview. The tray and renderer
therefore share one projection implementation and no durable active-provider
record is added.

The renderer receives only:

- platform id;
- `verified | none | stale | unavailable`;
- verified current Profile id, or `null`;
- check timestamp.

Profiles, snapshots, native digests, paths, config values and credentials do
not cross this IPC. `stale` means a previous verified snapshot no longer
matches the native config or Profile inventory. `unavailable` means the
main-process native read could not verify the state. Both states remove the
current marker and keep activation available through the existing review
flow.

The Provider master list and detail header show a localized current marker
only for `verified`. Selecting that Profile disables the redundant activation
action. A successful workspace activation re-queries the shared projection
before updating the marker; it never assumes success from the clicked Profile
id alone. Late list/current-state responses are discarded by the existing
platform generation guard.

One per-platform workspace load is `O(P + F)`, where `P` is the bounded
Profile list and `F` is one adapter's bounded native config read. The list and
current-state reads run concurrently, while filesystem work remains
main-process-owned and bounded.

### CC Switch reuse record

- Evidence: CC Switch `v3.18.0`
  (`606e7bbe75db7f8285f7a3be006fac22b5d22796`),
  `src/components/providers/ProviderList.tsx` and
  `src/components/providers/ProviderCard.tsx`.
- Reused concept: make the active Provider visually unambiguous and avoid a
  redundant switch action.
- Not reused: source code, Tauri commands, SQLite schema, credential storage,
  proxy/failover state and branded assets.
- PromptHub ownership: shared contracts, Electron IPC, verified native
  projection, renderer store and Provider workspace.
