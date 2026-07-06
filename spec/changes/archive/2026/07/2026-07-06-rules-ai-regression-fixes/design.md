# Design

## Rules IPC

- ensure rules workspace bootstrap runs during desktop startup before IPC registration completes
- keep rules IPC registration in the central registrar

## Rules Restore

- add explicit restore-time synchronization from managed copy to target file
- add a replace-mode cleanup step for project rules absent from the imported payload

## Rule Versions

- stop deriving the next stored version filename from the retained list length
- derive the next numeric filename from the stored index so filenames remain monotonic

## AI Protocol Handling

- convert multimodal chat content into Anthropic content blocks instead of flattening to plain text
- preserve `apiProtocol` in the legacy `AISettings` add/edit paths

## Verification

- unit tests for rules workspace import + retention
- unit tests for Anthropic multimodal request shaping
- unit tests for AI settings legacy add/edit protocol preservation
