# Pi Agent Separation Requirements

## `FR-PI-001`: Distinct Product Identity

PromptHub MUST expose Pi and Oh My Pi as two built-in Agents with unique ids,
names, executables and default roots.

### Scenario: Both products are installed

- Given `~/.pi/agent` and `~/.omp/agent` both exist
- When PromptHub detects built-in Agents
- Then both `pi` and `oh-my-pi` are returned
- And neither entry replaces or deduplicates the other

## `FR-PI-002`: Native Pi Assets

The Pi Agent MUST derive Skills, extensions, global instructions and editable
non-secret configuration from `~/.pi/agent` or its resolved override.

The Pi Agent MUST NOT claim native MCP support solely because an optional Pi
extension can provide MCP.

## `FR-PI-003`: Bounded Read-Only Sessions

PromptHub MUST list and read Pi JSONL sessions from the Pi session root using
the existing bounded, symlink-safe, lazy transcript behavior. Pi results MUST
retain `agentId: pi`, use the `pi` executable for resume, and never read Oh My
Pi's default root.

## `FR-PI-004`: Non-Secret Model Selection

PromptHub MUST inspect and update Pi's `defaultProvider` and `defaultModel`
selection in `settings.json` without reading or exposing authentication data.
Writes MUST preserve unrelated JSONC fields, use backup plus atomic
replacement, detect concurrent changes and verify the persisted result.

## Traceability

| Requirement | Design       | Verification  | Task       |
| ----------- | ------------ | ------------- | ---------- |
| `FR-PI-001` | `DES-PI-001` | `TEST-PI-001` | `T-PI-001` |
| `FR-PI-002` | `DES-PI-002` | `TEST-PI-002` | `T-PI-002` |
| `FR-PI-003` | `DES-PI-003` | `TEST-PI-003` | `T-PI-003` |
| `FR-PI-004` | `DES-PI-004` | `TEST-PI-004` | `T-PI-004` |
