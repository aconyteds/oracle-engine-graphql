import { ChatOpenAI } from "@langchain/openai";
import type { AIAgentDefinition } from "../types";
import { RouterType } from "../types";
import { characterGenerator } from "./characterGenerator";
import { cheapest } from "./cheapest";
import { locationAgent } from "./locationAgent";
// Reuse the router builder to ensure the default router is properly configured
import { buildRouterAgent } from "./Router";

const defaultRouterDefinition: AIAgentDefinition = {
  name: "default_router",
  model: new ChatOpenAI({
    model: "gpt-5-nano",
    maxRetries: 0,
    reasoning: {
      effort: "minimal",
    },
  }),
  description:
    "A router agent that intelligently routes requests to specialized agents.",
  specialization: "intelligent request routing and delegation",
  systemMessage: `You are an intelligent router agent. Your job is to analyze user requests and route them to the most appropriate specialized agent based on their expertise.`,
  availableTools: [],
  availableSubAgents: [cheapest, characterGenerator, locationAgent],
  routerType: RouterType.Handoff,
};

// Agents with sub-agents should be converted to router agents
export const defaultRouter = buildRouterAgent(defaultRouterDefinition);
