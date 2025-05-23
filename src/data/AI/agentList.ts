import { ClientOptions } from "openai";
import { getModelByName, TrustedModel } from "./modelList";

export type AIAgentDefinition = {
  model: TrustedModel;
  description: string;
  systemMessage: string;
  useHistory: boolean;
  clientConfigurationOverrides?: ClientOptions;
};

export const AGENT_LIST = new Map<string, AIAgentDefinition>([
  [
    "Cheapest",
    {
      model: getModelByName("gpt-4.1-nano"),
      description:
        "A smaller version of GPT-4.1 with a context window of 1,047,576 tokens.",
      systemMessage:
        "You are a helpful assistant who will answer questions in a jovial manner.",
      useHistory: true,
    },
  ],
]);

export function getAgentByName(name: string): AIAgentDefinition {
  return AGENT_LIST.get(name) as AIAgentDefinition;
}

export function getDefaultAgent(): AIAgentDefinition {
  return getAgentByName("Cheapest");
}
