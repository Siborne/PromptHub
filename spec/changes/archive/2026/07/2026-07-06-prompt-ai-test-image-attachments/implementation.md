# Implementation

## Status

Implemented.

## Changes

- Added transient Prompt AI Test image attachments for chat prompt tests.
- Local files are read in the renderer via `FileReader`, previewed in the modal, and sent as base64 data URLs.
- Converted the Prompt AI test surface into a right-side workbench drawer with an expand mode.
- Routed Prompt detail and compare entry points into the same workbench instead of the old inline test/variable-first flow.
- Added the same attachment entry point to the unified workbench, so variables, images, single-model tests, multi-model comparison, image generation, output format, and results share one surface.
- Restricted attachment input to PNG, JPG, WebP, and GIF, with a maximum of 8 images and 10 MiB per image.
- Extended chat message typing and `buildMessagesFromPrompt` so image attachments produce OpenAI-compatible multimodal `content` parts while text-only prompts keep the legacy string shape.
- Reused the same attachment set for single-model testing and multi-model comparison.
- Added locale keys for the new attachment UI and validation errors across all renderer locales.
- Added AI transport tests for text-only compatibility, multimodal message construction, and request body serialization.
- Added component regression tests for the unified workbench drawer and the variable-fill attachment control.

## Verification

- Passed: `pnpm --filter @prompthub/desktop test -- --run tests/unit/components/ai-test-workbench.test.tsx tests/unit/components/variable-input-modal.test.tsx tests/unit/services/ai-transport.test.ts`
- Passed: `pnpm --filter @prompthub/desktop lint`
- Passed: `pnpm --filter @prompthub/desktop typecheck`
- Full suite attempted with `pnpm --filter @prompthub/desktop test -- --run`; the new AI transport tests passed, but the run failed on an existing `skill-i18n-smoke` zh-TW skill-key alignment failure and then reported a Vitest worker OOM.

## Follow-ups

- Resolve the unrelated zh-TW skill locale alignment failure so full-suite verification can return green.
