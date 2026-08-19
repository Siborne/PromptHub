import type {
  AIModelConfig,
  AIProviderConfig,
} from "../../stores/settings.store";
import type { ChatImageAttachment } from "../../services/ai";
import type { Prompt } from "@prompthub/shared/types";

export interface AiTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: Prompt | null;
  initialMode?: "single" | "compare" | "image";
  filledSystemPrompt?: string;
  filledUserPrompt?: string;
  onUsageIncrement?: (promptId: string) => void;
  onSaveResponse?: (promptId: string, response: string) => void;
  onAddImage?: (imageUrl: string) => void;
}

export interface AiTestImageAttachment extends ChatImageAttachment {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
}

export const MAX_AI_TEST_IMAGES = 8;
export const MAX_AI_TEST_IMAGE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_AI_TEST_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export function getProviderDisplayName(
  model: AIModelConfig | null,
  providers: AIProviderConfig[],
): string | null {
  if (!model) return null;

  const exactMatch = providers.find(
    (provider) =>
      provider.provider === model.provider &&
      provider.apiProtocol === model.apiProtocol &&
      provider.apiUrl === model.apiUrl &&
      provider.apiKey === model.apiKey,
  );
  const endpointMatch =
    exactMatch ??
    providers.find(
      (provider) =>
        provider.provider === model.provider &&
        provider.apiProtocol === model.apiProtocol &&
        provider.apiUrl === model.apiUrl,
    );

  return (
    endpointMatch?.name?.trim() || endpointMatch?.provider || model.provider
  );
}
