import { ChatOpenAI } from "@langchain/openai";

export function createLLM() {
  return new ChatOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
    model: "gpt-4o-mini",
    maxTokens: 2000,
    temperature: 0.7,
  });
}
