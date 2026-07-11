import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { OLLAMA_BASE_URL } from "./config";

export const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: `${OLLAMA_BASE_URL}/v1`,
});
