# Skill Frontmatter YAML Parser

## Why

GitHub issue #183 identifies a destructive metadata path: multiple Desktop, CLI, Web, marketplace, and detail-view surfaces parse `SKILL.md` frontmatter with incomplete line-based or regex parsers, so YAML block scalars are truncated and `allowed-tools`, nested metadata, and unknown extension fields can disappear when Desktop rewrites frontmatter after a metadata edit.

## Scope

- Replace duplicated Desktop, CLI, Web, marketplace, and detail-view parsers with one YAML-backed parser owned by `packages/core`.
- Preserve the Agent Skills standard fields, including `metadata` and `allowed-tools`.
- Preserve unknown frontmatter fields when an existing `SKILL.md` is rewritten.
- Use the same serializer for Desktop and CLI exports.
- Add regression coverage for block scalars, quoted nested metadata, malformed YAML, and metadata-only rewrites.
- Preserve indentation while extracting embedded `SKILL.md` content from skills.sh detail HTML.

## Non-Goals

- Add `allowed-tools` as a new SQLite column or editable renderer field.
- Normalize user-authored YAML formatting byte-for-byte.
- Change the Skill package directory or database source-of-truth boundaries.
- Replace Prompt workspace frontmatter parsers, which own a separate Prompt document schema rather than `SKILL.md`.

## Risks And Rollback

- Standard YAML parsing is stricter than the previous parser. Invalid frontmatter must fail explicitly rather than being partially accepted.
- Serialization can normalize quoting or block-scalar style while preserving values.
- Rollback removes the shared parser/serializer and restores the existing adapters; no schema or data migration is required.

## Impacted Flow

`SKILL.md` read/import -> shared YAML parse -> DB/UI metadata derivation -> metadata edit -> shared YAML serialization -> atomic repository file write.
