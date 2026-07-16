# CLI And Skill Automation Hardening

## Phase And Status

- Phase: converge
- Status: review-pending
- Primary requirements: `FR-CR-001`, `FR-SP-001`, `FR-CC-001`, `FR-ST-001`
- Exit condition: implementation, stable-document convergence, and verification are complete; the change remains active only until its scoped code and records are submitted.

## Why

Agent-driven use exposed four related reliability gaps: a legacy Desktop CLI wrapper can still shadow the standalone CLI, ownerless database locks have no guided recovery path, Skill package copies and snapshots do not consistently apply the shared ignore policy or block secrets, and successful CLI mutations can emit complete file bodies. The desktop Skill detail also compresses upstream, managed, and distributed locations into one source label.

## Scope

- In scope:
  - detect the legacy Desktop `prompthub` wrapper without executing it and remove it only after standalone CLI installation succeeds
  - reject direct retired `PromptHub --cli` launches before updater, database, migrations, or window bootstrap
  - add an explicit guarded database-lock doctor command; keep normal CLI startup conservative
  - make built-in ignore rules and root `.prompthubignore` apply to CLI inventory, managed copy, snapshot, fingerprint, and distribution paths
  - block high-confidence private keys, access tokens, and password assignments before managed copy, version snapshot, or distribution
  - add global `--quiet`, `--summary`, and `--full`; keep large Skill payloads summarized by default
  - add `skill import`, `skill distribute`, and `skill undistribute` aliases while preserving existing commands
  - display upstream source, editable package, and distributed platform targets as a compact desktop asset topology
- Out of scope:
  - deleting unknown database locks automatically during every CLI command
  - storing raw secret evidence or implementing a general-purpose secret vault
  - removing existing CLI command aliases in this release
  - changing SQLite schema or Skill persistence schema

## Risks

- An ignore matcher can accidentally omit a required package file; root `SKILL.md` is therefore never ignorable.
- Generic secret patterns can produce false positives; only high-confidence patterns block, placeholders and examples remain allowed, and diagnostics contain no secret value.
- Removing the legacy wrapper before a replacement exists would break the command; cleanup occurs only after package installation succeeds and only for the exact recognized wrapper.
- Changing default CLI payloads can affect scripts; `--full` preserves the prior representation.
- A package with more than the bounded scan capacity must fail closed rather than silently copy unscanned tail files; users can split it or exclude generated/dependency paths.

## Rollback Thinking

- Remove the new global output flags and summary adapters to restore prior payloads.
- Stop loading `.prompthubignore` while retaining the existing built-in predicate.
- Remove the doctor route without changing the default database initializer.
- Legacy wrapper detection fields are optional and can be ignored by older renderer builds.
- The topology component is presentation-only and can be removed without data migration.

## Related Records

- Stable knowledge: `spec/knowledge/behavior/database-concurrency.md`, `spec/knowledge/behavior/skills.md`
- Related active changes: `cli-feature-completeness`, `cli-install-manual-fallback`, `skill-install-safety-resilience`, `skill-source-update-reconciliation`
- Issue: user-reported CLI and Skill automation audit, 2026-07-16
