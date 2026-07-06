# Proposal

## Why

Recent desktop changes introduced regressions across rules workspace IPC, rules backup/restore, rule version retention, and AI protocol handling.

## Scope

- restore stable `rules:*` IPC availability on desktop startup
- fix rules backup/import so restored content reaches real target files
- fix rules version retention so historical snapshots are not corrupted after the retention limit
- fix Anthropic multimodal chat requests so image attachments are preserved
- fix legacy AI settings model creation/edit flows so `apiProtocol` is not dropped

## Risks

- rules restore touches user workspace files and must avoid destructive deletes outside managed records
- AI protocol fixes must preserve existing OpenAI/Gemini behavior

## Rollback

- revert this change folder's code changes and keep the previous managed-copy-only rules behavior
