/**
 * LLM Configuration — ONLY file you need to touch to swap models/keys.
 *
 * OpenAI:     import { ChatOpenAI } from "@langchain/openai";
 * Anthropic:   import { ChatAnthropic } from "@langchain/anthropic";
 * Together:    Use OpenAI base with custom endpoint
 */
import { ChatOpenAI } from "@langchain/openai";

/** @returns {import('@langchain/core/language_models/chat_models').BaseChatModel} */
export function createLLM() {
  return new ChatOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
    model: "gpt-4.1-nano-2025-04-14",
    maxTokens: 500,
    temperature: 0.7,
  });
}
