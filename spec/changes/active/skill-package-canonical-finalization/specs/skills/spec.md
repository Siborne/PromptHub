# Skills Delta

## FR-SKCF-001 Install Under Canonical Authority

When canonical files are the local authority, a valid Skill package install
MUST complete and persist one Skill, its initial version, and its complete
package payload.

## FR-SKCF-002 Reopened Runtime

The same install MUST remain writable after PromptHub closes and reopens the
existing canonical root and database.

## FR-SKCF-003 Atomic Failure

If database or canonical publication finalization fails, PromptHub MUST restore
the previous SQLite and filesystem state and return a structured failure. It
MUST NOT report success or retain an abandoned pending Skill.

## Acceptance Scenarios

- `TEST-SKCF-001`: run the real Desktop lifecycle with `CanonicalSkillDB` and a
  content package; assert completed state, version 1, readable `SKILL.md`, and
  no lifecycle residue.
- `TEST-SKCF-002`: close and reopen the database/root, install another package,
  and assert the same durable result.
- `TEST-SKCF-003`: inject final publication failure and assert SQLite,
  canonical bundle, managed repo, and staging rollback.
