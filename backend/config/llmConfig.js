import { ChatOpenAI } from '@langchain/openai';

function createLLM() {
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.MODEL || 'gpt-4o',
    maxTokens: 10000,
    temperature: 0.6,
  });
}

export { createLLM };
