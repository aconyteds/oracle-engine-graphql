import { ChatOpenAI } from "@langchain/openai";

export const DEFAULT_OPENAI_MODEL = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o",
  temperature: 0.7,
});
