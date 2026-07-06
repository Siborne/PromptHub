# Proposal

## Why

Prompt AI testing currently sends only text messages. Multimodal chat models can inspect images, but users cannot attach local images when testing a prompt, so image-understanding prompts cannot be validated inside PromptHub.

## Scope

- In scope:
  - Add local image attachments to the Prompt AI test modal for chat and multi-model comparison.
  - Encode selected images as base64 data URLs in the chat message payload.
  - Preserve existing text-only behavior when no images are attached.
  - Add focused tests for multimodal message construction and request transport payloads.
- Out of scope:
  - Persisting test-only attachments to prompt records.
  - Supporting non-image files or video/audio multimodal input.
  - Provider-specific native APIs outside the existing OpenAI-compatible chat flow.

## Risks

- Large images can create oversized request bodies, so the UI must enforce attachment count and per-file size limits.
- Some configured chat models may not support image input; those providers should return their normal API error without blocking text-only tests.
- Streaming and multi-model comparison must continue to use the same request payload shape.

## Rollback Thinking

Revert the modal attachment UI and the optional `buildMessagesFromPrompt` attachment parameter. Since attachments are test-only and not persisted, rollback has no data migration impact.
