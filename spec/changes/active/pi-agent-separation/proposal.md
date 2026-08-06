# Pi Agent Separation

## Why

PromptHub currently models Oh My Pi but not its upstream Pi product. Pi and
Oh My Pi use different executables, default roots, release lifecycles and
session stores, so treating the existing Oh My Pi entry as coverage for both
products hides installed Pi assets and conversations.

## Scope

- Add Pi as a distinct built-in Agent beside Oh My Pi.
- Keep independent detection, configuration, Skill, extension, rule, CLI and
  session paths.
- Reuse the verified Pi-family JSONL parser without aliasing platform identity
  or storage.
- Bundle Pi's official badge as a traceable local platform asset instead of a
  generic icon fallback.
- Bundle Oh My Pi's official plugin-connected mark with a theme-safe backing so
  it remains legible on the Agent workbench.
- Keep native MCP capability unsupported for the Pi Agent until a native
  built-in contract exists; extension-provided MCP remains owned by Pi
  packages. The separate MCP manager may write explicitly selected compatible
  `mcpServers` files, but that writer is not exposed as Pi's native Agent
  capability and does not execute or install an adapter.

## Risk And Rollback

- A shared `PI_CODING_AGENT_DIR` environment variable can intentionally
  relocate either product. Explicit PromptHub root overrides remain the
  unambiguous way to manage both simultaneously when that variable is set.
- The change adds no schema or migration. Rollback removes the Pi registry
  entry and adapter routing without modifying user files.
