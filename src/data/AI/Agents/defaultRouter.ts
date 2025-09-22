import { cheapest } from "./cheapest";
import { characterGenerator } from "./characterGenerator";
import type { AIAgentDefinition } from "../types";
import { getModelByName } from "../modelList";
// Reuse the router builder to ensure the default router is properly configured
import { buildRouterAgent } from "./Router";

const defaultRouterDefinition: AIAgentDefinition = {
  name: "Default Router",
  model: getModelByName("gpt-4.1"),
  description:
    "A router agent that intelligently routes requests to specialized agents.",
  specialization: "intelligent request routing and delegation",
  systemMessage: `You are an intelligent router agent. Your job is to analyze user requests and route them to the most appropriate specialized agent based on their expertise.`,
  availableTools: [],
  availableSubAgents: [cheapest, characterGenerator],
  routerType: "router",
};

// Agents with sub-agents should be converted to router agents
export const defaultRouter = buildRouterAgent(defaultRouterDefinition);
