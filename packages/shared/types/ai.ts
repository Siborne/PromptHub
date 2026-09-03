export interface AITransportMultipartFile {
  fieldName: string;
  fileName: string;
  mimeType: string;
  base64: string;
}

export interface AITransportMultipartBody {
  fields: Record<string, string>;
  files: AITransportMultipartFile[];
}

export interface AITransportRequest {
  requestId?: string;
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  body?: string;
  multipart?: AITransportMultipartBody;
  timeoutMs?: number;
}

export type AIProtocol = "openai" | "gemini" | "anthropic";

export interface AITransportResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
  error?: string;
}

export interface AITransportStreamChunk {
  requestId: string;
  chunk: string;
}

export interface AITransportStreamError {
  requestId: string;
  error: string;
}
