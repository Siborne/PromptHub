# Design

## Boundary

- Owner: `apps/desktop` renderer startup and settings store.
- Durable fallback: the existing SQLite-backed `settings.language` returned by
  `window.api.settings.get()`.
- Backward compatibility: an explicit language in the existing
  `prompthub-settings` Zustand payload retains precedence.
- Contract impact: none; `Settings.language` already exists in shared types and
  the IPC get/set handlers.

## Approach

The settings persistence module validates the language in the raw Zustand
payload before it is merged with renderer defaults. Startup retains whether
that preference existed before Zustand can write a new payload. Hydration only
includes `language` in its main-process sync when the captured preference was
explicit. The later main-process load applies a supported `settings.language`
through the existing `setLanguage` action only when the renderer preference was
absent.

This keeps current users' explicit local preference intact while allowing
SQLite to recover language after renderer origin/storage loss. It also avoids
introducing a third setting or changing data ownership.

## Complexity And Resources

The persistence check parses one bounded localStorage value once at startup;
time is `O(n)` in the serialized settings payload and additional memory is
`O(n)` during JSON parsing, matching the existing i18n initialization behavior.
No additional I/O, network calls, processes, ports, caches, retries, or
long-lived resources are introduced.

## Verification Mapping

- `TEST-LANG-001` -> `FR-LANG-003`: no persisted language means hydration sync
  omits `language`.
- `TEST-LANG-002` -> `FR-LANG-002`: main `zh` restores renderer state when the
  renderer preference is absent.
- `TEST-LANG-003` -> `FR-LANG-001`: persisted renderer language wins over a
  different main value.
- `TEST-LANG-004` -> `FR-LANG-004`: existing malformed-storage coverage remains
  green.

No performance/stress harness is required because startup work remains one
bounded local parse and one existing IPC read. Security behavior is unchanged;
the helper accepts only supported language identifiers before a value is used.
