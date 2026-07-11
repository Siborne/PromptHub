# Tasks

- [x] `T-SFY-001` Add failing block-scalar, malformed-YAML, and root-type parser tests for `FR-SFY-001` / `NFR-SFY-001` (`DES-SFY-001`, `TEST-SFY-001`, `TEST-SFY-005`).
- [x] `T-SFY-002` Add failing `allowed-tools` and nested metadata tests for `FR-SFY-002` (`DES-SFY-002`, `TEST-SFY-002`).
- [x] `T-SFY-003` Add a failing metadata-only rewrite regression proving standard and extension fields survive for `FR-SFY-003` (`DES-SFY-003`, `TEST-SFY-003`).
- [x] `T-SFY-004` Implement the shared parser/serializer and migrate Desktop/CLI adapters for `FR-SFY-004` (`DES-SFY-004`, `TEST-SFY-004`).
- [x] `T-SFY-005` Run focused Desktop/CLI tests and affected package typechecks.
- [x] `T-SFY-006` Sync stable Skill behavior, issue tracking, and implementation results.
- [x] `T-SFY-007` Scan remaining SKILL.md consumers and add failing Web, marketplace, and detail-view regressions for `FR-SFY-004` / `FR-SFY-005` (`DES-SFY-004`, `TEST-SFY-006`).
- [x] `T-SFY-008` Migrate the confirmed parser bypasses, preserve skills.sh YAML indentation, and verify Desktop/Web production builds.

## Verification IDs

- `TEST-SFY-001`: YAML literal/folded block scalar behavior.
- `TEST-SFY-002`: `allowed-tools`, nested metadata, flow values, and quoted scalar behavior.
- `TEST-SFY-003`: metadata-only repository rewrite preservation.
- `TEST-SFY-004`: Desktop and CLI shared round-trip behavior.
- `TEST-SFY-005`: malformed YAML, non-object roots, aliases, empty frontmatter, and no-frontmatter compatibility.
- `TEST-SFY-006`: Web remote import, GitHub, ClawHub, skills.sh, and Skill detail block-scalar/list behavior.
