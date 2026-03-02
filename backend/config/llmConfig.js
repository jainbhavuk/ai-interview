import { ChatOpenAI } from '@langchain/openai';

function createLLM() {
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4.1-mini',
    maxTokens: 10000,
    temperature: 0.5,
    topP: 0.9,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
  });
}

export { createLLM };
