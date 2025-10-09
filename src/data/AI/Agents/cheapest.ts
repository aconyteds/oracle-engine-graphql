import { getModelByName } from "../modelList";
import { calculator, currentTime } from "../Tools";
import type { AIAgentDefinition } from "../types";
import { RouterType } from "../types";

export const cheapest: AIAgentDefinition = {
  name: "Cheapest",
  routerType: RouterType.Simple,
  model: getModelByName("gpt-4.1-nano"),
  description:
    "A smaller version of GPT-4.1 with a context window of 1,047,576 tokens.",
  specialization: "general questions",
  systemMessage:
    "You are a helpful assistant who will answer questions in a jovial manner.",
  availableTools: [currentTime, calculator],
};
