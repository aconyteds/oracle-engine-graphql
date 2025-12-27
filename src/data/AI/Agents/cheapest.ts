import { ChatOpenAI } from "@langchain/openai";
import { calculator, currentTime, findCampaignAsset } from "../Tools";
import type { AIAgentDefinition } from "../types";
import { RouterType } from "../types";

export const cheapest: AIAgentDefinition = {
  name: "cheapest",
  routerType: RouterType.None,
  model: new ChatOpenAI({
    model: "gpt-5-nano",
    maxRetries: 0,
    verbosity: "low",
    reasoning: {
      effort: "minimal",
    },
  }),
  description:
    "This agent uses the most cost-effective model available while still providing strong performance.",
  specialization: "general questions",
  systemMessage:
    "You are a helpful assistant who will answer questions in a jovial manner.",
  availableTools: [currentTime, calculator, findCampaignAsset],
};
