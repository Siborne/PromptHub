# Proposal

## Summary

When copying a prompt through the variable input modal, empty user-variable fields should resolve to the variable name instead of leaving `{{variable}}` placeholders in the copied prompt.

## Why

Users expect a copied prompt to be immediately usable even when a variable value is intentionally left blank. Falling back to the variable name preserves readable output and matches the requested copy workflow.

## Scope

- Copy-mode variable input in the desktop renderer.
- Preview and clipboard output for user-defined variables.

## Out Of Scope

- AI test variable validation.
- Renaming variables in the underlying prompt template.
- Shared prompt parsing syntax changes.
