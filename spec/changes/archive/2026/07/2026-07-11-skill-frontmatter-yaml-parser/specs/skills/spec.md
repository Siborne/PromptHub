# Skills Delta Spec

## Requirements

### FR-SFY-001 Standard YAML Parsing

PromptHub MUST parse valid YAML scalar forms in `SKILL.md` frontmatter, including literal and folded block scalars, quoted values, flow collections, and nested maps.

### FR-SFY-002 Standard Field Preservation

PromptHub MUST expose and preserve the Agent Skills standard optional fields `license`, `compatibility`, `metadata`, and `allowed-tools` when reading and rewriting an existing Skill.

### FR-SFY-003 Extension Preservation

Metadata-only edits MUST preserve unknown frontmatter extension fields instead of silently deleting them.

### FR-SFY-004 Shared Contract

Desktop, CLI, Web remote import, marketplace adapters, and Skill detail rendering MUST use the same parser owned by `packages/core`; all SKILL.md serializers MUST use the matching shared serializer.

### FR-SFY-005 Embedded Content Preservation

Adapters that extract `SKILL.md` from another document MUST preserve YAML indentation before invoking the shared parser.

### NFR-SFY-001 Safe Failure

Malformed YAML or a non-object frontmatter root MUST fail parsing without returning partially trusted metadata or executing custom YAML tags.

## Acceptance Criteria

### AC-SFY-001

Given a description written with `|-` or `>-`, parsing returns the complete YAML-semantic string.

### AC-SFY-002

Given `allowed-tools: Read, Bash(git add *)` and quoted nested metadata, parsing returns the expected values without extra quote characters.

### AC-SFY-003

Given an existing Skill with `allowed-tools`, `metadata`, and an unknown extension key, editing tags or another DB-backed metadata field keeps those fields in the rewritten `SKILL.md`.

### AC-SFY-004

Desktop and CLI round-trip the same fixture through the shared contract.

### AC-SFY-005

Web remote import, GitHub, ClawHub, skills.sh, and Skill detail views derive complete block-scalar descriptions and block-list tags from the same fixture semantics.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-SFY-001` | `DES-SFY-001` | `TEST-SFY-001` | `T-SFY-001` |
| `FR-SFY-002` | `DES-SFY-002` | `TEST-SFY-002` | `T-SFY-002` |
| `FR-SFY-003` | `DES-SFY-003` | `TEST-SFY-003` | `T-SFY-003` |
| `FR-SFY-004` | `DES-SFY-004` | `TEST-SFY-004` | `T-SFY-004` |
| `FR-SFY-005` | `DES-SFY-004` | `TEST-SFY-006` | `T-SFY-007` |
| `NFR-SFY-001` | `DES-SFY-001` | `TEST-SFY-005` | `T-SFY-001` |
