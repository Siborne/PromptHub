# MCP Issues 200/201/202 Implementation

## Problem

The MCP manager has three related gaps:

- #200: Library detail, distribution counts, and batch deployment only inspect global targets, so project targets are missing from the `My MCP` workflow.
- #201: Pi is not represented as a first-class MCP target. The manager therefore cannot expose the Pi adapter's global and project files or explain their precedence.
- #202: MCP environment references are stored and rendered as one generic string shape. This makes target-specific interpolation unreliable and allows preview/export/sync payloads to expose direct values.

## Scope

This change adds:

1. A single merged target set for library/detail/batch distribution, while keeping the Agent and Project workspaces separately navigable.
2. Pi target presets for the adapter-supported global and project paths.
3. Canonical MCP environment-reference storage with target-specific rendering for JSON and Codex TOML targets.
4. Redaction for generated previews, apply/remove results, and MCP library transport snapshots. Legacy direct values remain supported for compatibility and are explicitly treated as direct values.
5. Focused regression tests and a compatibility matrix in the stable agent-platform reference.

## Non-goals

- This change does not claim that PromptHub is the `pi-mcp-adapter` runtime. PromptHub writes compatible config files; Pi or the adapter remains the runtime owner.
- This change does not invent a new secret vault or change the existing agent secret-store contract. Direct values remain backward-compatible local values; environment references are the recommended portable form.
- This change does not close GitHub issues before a release containing the change is published.

## Compatibility and rollback

Existing `env` and `headers` maps remain readable. Values containing supported environment-reference syntax are normalized into reference maps; literal values remain literal. Existing target files are merged as before. If a target write fails before the atomic rename, the original file is left intact; the generated backup remains the rollback point for a successful replacement.

The serialized library shape remains version 1 with additive optional fields. A previous binary ignores the new fields and continues to read the legacy literal maps.

## Risks

- A target may accept a different interpolation syntax than its documentation currently describes. The renderer therefore has an explicit capability table and never substitutes a secret value into a reference.
- Redacted transport snapshots cannot restore a literal value that is absent locally. Restore preserves an existing local literal value when the incoming snapshot contains the redaction marker; a missing local value must be entered again.
- Pi exposes several paths with precedence. Applying to more than one Pi preset is intentional and visible in the target list; PromptHub does not silently collapse them.
