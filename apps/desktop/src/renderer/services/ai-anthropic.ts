import type { ChatMessageContent, ChatMessageContentPart } from "./ai-types";

type AnthropicMessageContentPart =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

export function normalizeAssistantContent(content: ChatMessageContent): string {
  if (typeof content === "string") return content;

  return content
    .filter(
      (part): part is Extract<ChatMessageContentPart, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

export function toAnthropicMessageContent(
  content: ChatMessageContent,
): string | AnthropicMessageContentPart[] {
  if (typeof content === "string") return content;

  const parts = content.flatMap((part): AnthropicMessageContentPart[] => {
    if (part.type === "text") return [{ type: "text", text: part.text }];
    if (part.type !== "image_url") return [];

    const match = part.image_url.url.match(/^data:(.+?);base64,(.+)$/);
    if (!match) return [];
    return [
      {
        type: "image",
        source: { type: "base64", media_type: match[1], data: match[2] },
      },
    ];
  });

  return parts.length > 0 ? parts : "";
}
