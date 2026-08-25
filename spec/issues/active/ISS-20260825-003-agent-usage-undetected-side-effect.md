# Undetected Agent Usage Probe Creates Native State

## Record

- ID: `ISS-20260825-003`
- Status: local_done (release pending)
- Severity: high local-state side effect
- Owning change: `spec/changes/active/agent-management-workbench/`
- First local triage: 2026-08-25
- Automated evidence:
  `apps/desktop/tests/e2e/agent-discovery-side-effects.spec.ts`

## Confirmed Phenomenon

An isolated Electron profile contained only a Claude Code root. Eight seconds
after launch, opening Agents showed `Antigravity` even though the isolated
`.gemini` root did not exist before launch. The focused Electron test failed
because the Antigravity sidebar button count was one instead of zero.

## Root Cause

The startup tray projected every usage-capable platform and called the shared
usage service for each one. The service dispatched directly to the Antigravity
adapter without checking the resolved installation root. Its local usage client
may start the installed Antigravity language-service helper when no trusted
desktop process is running. That helper initializes `.gemini`; the later
root-based Agent discovery then misclassifies Antigravity and Gemini as
installed.

This violates the installed-only Agent contract and is not a locator or timing
failure.

## Resolution

The shared main-process usage service now checks the resolved Agent root before
dispatching to any usage adapter. A missing root returns
`agent-not-installed` without reading credentials, listing processes, starting
a helper, or making a network request. The check is one bounded filesystem
access per uncached usage request and prevents the same class of side effect for
all tray and renderer callers.

Traceability: `FR-AGENT-133 -> DES-AGENT-152 -> TEST-AGENT-214 ->
T-AGENT-223`.

## Required Verification

- Unit coverage proves a missing Antigravity root does not call the local usage
  client, keychain command resolver, or network fetch.
- A real isolated Electron launch waits for the startup tray scan, then proves
  Antigravity and Gemini remain absent and `.gemini` is not created.
- Existing supported usage-adapter tests remain green for detected roots.

## Verification

- Four focused usage-service suites passed: 120 tests, including the absent-root
  no-side-effect branch and every existing supported adapter branch.
- Desktop TypeScript validation and production build passed.
- `pnpm spec:traceability` passed.
- `pnpm --dir apps/desktop exec playwright test tests/e2e/agent-discovery-side-effects.spec.ts`
  passed in a real isolated Electron profile after waiting for the startup tray
  scan: Claude remained visible, Antigravity and Gemini remained absent, and
  `.gemini` was not created.
