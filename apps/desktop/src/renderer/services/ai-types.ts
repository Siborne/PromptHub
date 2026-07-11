import type { AIProtocol, PromptType } from "@prompthub/shared/types";

export interface ChatImageAttachment {
  name?: string;
  mimeType: string;
  base64: string;
}

export type ChatMessageContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail?: "auto" | "low" | "high";
      };
    };

export type ChatMessageContent = string | ChatMessageContentPart[];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  enable_thinking?: boolean;
  response_format?: {
    type: "text" | "json_object" | "json_schema";
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: ChatMessage & { reasoning_content?: string };
    finish_reason: string;
    delta?: { content?: string; reasoning_content?: string };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  enableThinking?: boolean;
  customParams?: Record<string, string | number | boolean>;
}

export interface ImageParams {
  size?: string;
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  n?: number;
}

export interface ImageReferenceAttachment {
  name?: string;
  mimeType: string;
  base64: string;
}

export interface AIConfig {
  id?: string;
  provider: string;
  apiProtocol: AIProtocol;
  apiKey: string;
  apiUrl: string;
  model: string;
  type?: "chat" | "image";
  chatParams?: ChatParams;
  imageParams?: ImageParams;
}

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  n?: number;
  size?: "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  response_format?: "url" | "b64_json";
}

export interface ImageGenerationResponse {
  created: number;
  data: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }[];
}

export interface ImageTestResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  revisedPrompt?: string;
  error?: string;
  latency?: number;
  model: string;
  provider: string;
}

export interface StreamCallbacks {
  onContent?: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onComplete?: (fullContent: string, thinkingContent?: string) => void;
}

export interface ChatCompletionResult {
  content: string;
  thinkingContent?: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  enableThinking?: boolean;
  onStream?: (chunk: string) => void;
  streamCallbacks?: StreamCallbacks;
  responseFormat?: {
    type: "text" | "json_object" | "json_schema";
    jsonSchema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  timeoutMs?: number;
}

export interface AITestResult {
  id?: string;
  success: boolean;
  response?: string;
  thinkingContent?: string;
  error?: string;
  latency?: number;
  model: string;
  provider: string;
}

export interface PromptRewriteInput {
  promptType: PromptType;
  title: string;
  description?: string | null;
  systemPrompt?: string | null;
  userPrompt: string;
  notes?: string | null;
  instruction: string;
}

export interface PromptRewriteResult {
  summary?: string;
  description?: string;
  systemPrompt?: string;
  userPrompt?: string;
  notes?: string;
}

export interface MultiModelCompareResult {
  messages: ChatMessage[];
  results: AITestResult[];
  totalTime: number;
}

export interface ModelInfo {
  id: string;
  name?: string;
  owned_by?: string;
  created?: number;
}

export interface FetchModelsResult {
  success: boolean;
  models: ModelInfo[];
  error?: string;
  reason?: "auth" | "network" | "unsupported" | "http" | "parse";
  endpoint?: string;
  status?: number;
}
