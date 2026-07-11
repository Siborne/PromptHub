# Web Workspace Capability Alignment

## Purpose

Make the self-hosted Web workspace reliable for browser-safe PromptHub work and
stop presenting Desktop-only operations as available browser features.

## Scope

- Add authenticated Web contracts for prompt hierarchy moves, relations, and
  output-format sequences.
- Connect the shared Desktop renderer bridge to those durable Web contracts.
- Hide MCP, Plugin, local Agent, local Skill package, and native shell flows
  that cannot be safely executed from a browser.
- Preserve MCP and Plugin snapshots through Web backup and Desktop sync without
  claiming they are browser-managed resources.

## Non-Goals

- Executing local Agent installation, filesystem scans, symlink operations, or
  target configuration writes from a browser.
- Adding a hosted SaaS, team, billing, or cloud-administration surface.
- Replacing the existing Desktop MCP or Plugin control planes.

## Risk And Rollback

The new Prompt routes write existing SQLite tables through their owning DB
classes and synchronize the existing workspace. Browser module filtering only
removes unsupported navigation. Rollback removes the routes and bridge entries;
existing Desktop data and opaque asset snapshots remain intact.
