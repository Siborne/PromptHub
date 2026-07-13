# ZCode Agent Support

## Problem

GitHub issue #186 requests built-in PromptHub support for 智谱 ZCode. ZCode
has documented local surfaces for user skills, global instructions, commands,
and native MCP configuration, but these surfaces are not currently present in
PromptHub's built-in Agent platform registry.

## Scope

- Add ZCode as a built-in Agent platform with its documented user root.
- Expose ZCode Skills, global `AGENTS.md`, and native MCP targets.
- Preserve unrelated settings in ZCode's nested `mcp.servers` configuration.
- Add project-level ZCode MCP target support and local regression coverage.
- Keep Plugin distribution disabled/pending until a stable ZCode package marker
  and local package path are publicly confirmed.
- Update stable Agent platform documentation and local issue delivery state.

## Risks and Rollback

The change writes only to paths selected through the existing MCP apply flow;
it does not install ZCode or alter credentials. Existing target files are
backed up before writes and unrelated JSON keys remain intact. Removing the
ZCode registry entries and tests restores the previous behavior.

## Issue State

GitHub issue #186 remains open until a release containing this support is
published. Local delivery is tracked as `local_done` after verification.
