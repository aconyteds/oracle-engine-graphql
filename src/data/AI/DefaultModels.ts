import { ChatOpenAI } from "@langchain/openai";
import { ENV } from "../../config/environment";

export const DEFAULT_OPENAI_MODEL = new ChatOpenAI({
  apiKey: ENV.OPENAI_API_KEY,
  model: "gpt-4.1",
  temperature: 0.7,
});
