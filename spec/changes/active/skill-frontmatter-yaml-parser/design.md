# Design

## DES-SFY-001 Shared YAML Boundary

Add a small pure module under `packages/core/src/skills/` using the `yaml` package. It owns frontmatter delimiter extraction, safe YAML parsing, root-object validation, typed normalization, and serialization. YAML parse failures return `null`; the validation layer converts that result into the existing user-facing validation error.

## DES-SFY-002 Typed And Raw Frontmatter

The parsed result exposes normalized standard fields for current consumers plus `rawFrontmatter`, a plain object used only to preserve fields that PromptHub does not own. `allowed-tools` maps to the TypeScript property `allowedTools`; metadata values are normalized to strings for the current public model while the raw map remains available for lossless field preservation.

## DES-SFY-003 Merge-On-Rewrite

Serialization begins with the existing raw frontmatter, overwrites DB-owned fields with the current Skill values, preserves file-owned standard and extension fields, and writes the original Markdown body. Undefined DB-owned optional fields are omitted. Existing formatting may normalize, but YAML values and unknown keys remain.

## DES-SFY-004 Adapter Migration

- Desktop `skill-validator.ts` keeps validation and name rules but re-exports the shared parser types/function.
- Desktop `skill-installer-export.ts` delegates SKILL.md serialization to the shared module.
- Desktop repo sync passes the parsed raw frontmatter into serialization.
- CLI parse helpers re-export the shared parser, and CLI export delegates to the shared serializer.
- Web remote Skill import maps the shared parser result into its existing API response.
- GitHub, ClawHub, and skills.sh marketplace adapters derive display metadata through the shared parser.
- Skill detail preview and description extraction use the shared parser instead of delimiter and line heuristics.
- skills.sh section extraction retains leading indentation before parsing embedded YAML.

## Data, Contract, And Compatibility

- SQLite: no schema change. `SKILL.md` remains the durable source for `allowed-tools`, metadata, and extension fields.
- Filesystem: no path/layout change. Existing files are rewritten through the current repository service.
- IPC: no change.
- Compatibility: no-frontmatter files remain body-only; valid legacy single-line frontmatter continues to parse; Web adds a direct workspace dependency on `packages/core` without changing its route contract.
- Failure: malformed YAML is rejected instead of being partially interpreted.

## Security

Use the YAML library's core schema and alias limit. Do not support executable/custom tags. Reject arrays, scalars, and null as the frontmatter root.
