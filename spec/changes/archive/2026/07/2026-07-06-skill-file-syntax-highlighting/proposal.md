# Proposal

## Why

The skill file editor currently renders editable code as plain textarea text. Code files such as Python scripts are difficult to scan because keywords, strings, comments, and structured data are not visually distinguished.

## Scope

- Add syntax highlighting to the skill file editor while preserving textarea-based editing.
- Detect common languages from file paths and extensions.
- Reuse the existing `highlight.js` dependency.
- Add focused unit tests for language detection, HTML escaping, and rendered editor behavior.

## Non-goals

- Replace the editor with Monaco or CodeMirror.
- Add autocomplete, linting, formatting, or diagnostics.
- Change skill filesystem behavior.
