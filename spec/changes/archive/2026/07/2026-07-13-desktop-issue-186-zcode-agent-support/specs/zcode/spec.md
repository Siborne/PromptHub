# ZCode Agent Support Delta

## FR-ZCODE-001 Built-in platform identity

PromptHub MUST expose 智谱 ZCode as a built-in Agent platform with a stable
`zcode` identifier, the default `~/.zcode` root, and its documented Skills and
global instruction paths.

## FR-ZCODE-002 Native MCP projection

PromptHub MUST expose ZCode global and project MCP targets. It MUST project
servers into ZCode's nested `mcp.servers` JSON shape, preserve unrelated
configuration, and preserve the disabled state represented by `enable: false`
when importing an existing target file.

## FR-ZCODE-003 Rules integration

PromptHub MUST expose the documented user-level `~/.zcode/AGENTS.md` file in
the Rules workspace without claiming support for every ZCode workspace
context file.

## FR-ZCODE-004 Evidence-boundary behavior

PromptHub MUST NOT enable native Plugin distribution for ZCode until a stable
local Plugin package marker and install path are confirmed. The unsupported
boundary MUST remain explicit in the platform documentation and Plugin target
matrix when applicable.

## AC-ZCODE-001

The Desktop Skills target list resolves `zcode` to `~/.zcode/skills` and the
Rules workspace resolves `zcode` to `~/.zcode/AGENTS.md`.

## AC-ZCODE-002

Applying a ZCode MCP target to an existing config preserves unrelated keys and
writes `mcp.servers.<name>` with the normalized server entry.

## AC-ZCODE-003

The project MCP target resolves to `<project>/.zcode/config.json`, and an
existing `enable: false` entry is imported as a disabled server.
