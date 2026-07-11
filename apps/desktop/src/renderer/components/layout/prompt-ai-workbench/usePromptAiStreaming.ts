import { useState } from "react";

export function usePromptAiStreaming() {
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  return {
    streamingContent,
    streamingThinking,
    isStreaming,
    setStreamingContent,
    setStreamingThinking,
    setIsStreaming,
  };
}
