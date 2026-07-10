# PromptHub Document Archive Rules

## Responsibility

This rule owns record IDs, indexes, lifecycle directories, and archive layout.
Semantic document routing remains defined by
`spec/rules/document-routing-rules.md`.

## Document Classes

### Stable State Documents

Stable project truth keeps durable semantic paths and does not require a global
record ID:

- `spec/workflow/*`
- `spec/knowledge/*`
- `spec/rules/*`
- directory-level `README.md` indexes

When a stable directory grows, split it by domain and keep its `README.md` as
the navigation entry.

### Standalone Records

New standalone internal records use typed IDs:

- `ISS-YYYYMMDD-NNN`: internal issue, risk, blocker, or technical debt
- `BUG-YYYYMMDD-NNN`: standalone defect record not already represented by a
  GitHub issue or active change
- `CR-YYYYMMDD-NNN`: change request awaiting scope or approval
- `ADR-YYYYMMDD-NNN`: architecture or material engineering decision

`NNN` is a three-digit sequence within the same type and date. The ID appears
in the document title/front matter and filename, for example:

```text
spec/issues/active/ISS-20260710-001-spec-governance-debt.md
spec/adr/ADR-20260710-001-record-id-policy.md
```

## PromptHub Compatibility

- Existing active and archived change directories are not renamed.
- New change directories continue using semantic lowercase kebab-case keys;
  issue-related keys prefer `<surface>-issue-<number>-<slug>`.
- Completed changes continue to move to
  `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`.
- `spec/changes/completed/` remains a compatibility entry for upstream
  `spec-init` completed semantics and is not a second physical store.
- Existing GitHub snapshots keep their GitHub issue numbers and stable paths;
  they do not receive duplicate `ISS-*` IDs.
- Existing historical records are not renamed solely to satisfy this rule; 本规则不重命名既有历史记录。

## Lifecycle Paths

```text
spec/changes/active/<change-key>/
spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/
spec/changes/legacy/<historical-key>/

spec/issues/active/ISS-YYYYMMDD-NNN-<slug>.md
spec/issues/archive/<YYYY>/<MM>/ISS-YYYYMMDD-NNN-<slug>.md

spec/adr/ADR-YYYYMMDD-NNN-<slug>.md
spec/adr/<YYYY>/ADR-YYYYMMDD-NNN-<slug>.md
```

A change moves out of `active/` only after tasks, verification, stable-doc
sync, implementation notes, and converge checks are complete. A blocked or
review-pending change stays active and records the remaining condition.

## Index Requirements

The following entry documents maintain navigable indexes:

- `spec/changes/README.md`: active, archive, and legacy inventories or links to
  generated inventories
- `spec/issues/README.md`: internal issue records and GitHub snapshot overlays
- `spec/adr/README.md`: every ADR
- `spec/releases/README.md`: every version record
- `spec/archive/README.md`: retired or migrated project-level documents

Each standalone record index row contains at least:

```text
| ID | Title | Status | Path | Related change/issue | Updated |
```

## Submission Links

Non-trivial commit bodies link both the record and its path when a typed record
exists:

```text
- Change: spec/changes/active/<change-key>
- Issue: ISS-YYYYMMDD-NNN / spec/issues/active/ISS-YYYYMMDD-NNN-<slug>.md
- ADR: ADR-YYYYMMDD-NNN / spec/adr/ADR-YYYYMMDD-NNN-<slug>.md
```

GitHub-backed work continues to use `Refs #<issue>` or, after release,
`Closes #<issue>` according to the issue and submission rules.

## Archive Checklist

1. The record status matches its destination.
2. Implementation and verification results are complete.
3. Stable workflow/knowledge/rules are synchronized.
4. Indexes and inbound paths are updated.
5. The old path is removed or explicitly marked as a compatibility entry.
6. Historical names are preserved unless a separately approved migration owns
   the rename and reference update.
