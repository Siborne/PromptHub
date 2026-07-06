# Design

## Approach

The renderer already owns Prompt AI test execution and calls `chatCompletion` directly. The change remains renderer-only:

- `AiTestModal` keeps a transient attachment list with file name, MIME type, byte size, base64 payload, and preview data URL.
- A hidden `<input type="file" accept="image/*" multiple>` reads local images with `FileReader`.
- Attachments are not saved to the prompt database.
- `buildMessagesFromPrompt` accepts optional image attachments and converts the user message content to OpenAI-compatible multimodal parts:
  - `{ type: "text", text }`
  - `{ type: "image_url", image_url: { url: "data:<mime>;base64,<payload>" } }`
- With no attachments, `buildMessagesFromPrompt` continues returning plain string content.

## Affected Modules

- `apps/desktop/src/renderer/components/prompt/AiTestModal.tsx`
- `apps/desktop/src/renderer/services/ai.ts`
- `apps/desktop/src/renderer/i18n/locales/*.json`
- `apps/desktop/tests/unit/services/ai-transport.test.ts`

## Limits

- Maximum 8 images per AI test.
- Maximum 10 MiB per image before base64 expansion.

## Tradeoffs

Base64 data URLs avoid new IPC or filesystem storage and match OpenAI-compatible multimodal chat APIs. Provider-specific native message formats can be added later if needed, but this keeps the first version aligned with the app's existing AI transport.
