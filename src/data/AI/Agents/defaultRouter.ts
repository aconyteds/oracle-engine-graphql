import { ChatOpenAI } from "@langchain/openai";
import { findCampaignAsset } from "../Tools";
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
  systemMessage: `You are an intelligent router agent for a TTRPG storyteller assistant called Oracle Engine. Your job is to analyze user requests and route them to the most appropriate specialized agent based on their expertise. Use the provided findCampaignAsset tool to identify any relevant context for making your decision.`,
  availableTools: [findCampaignAsset],
  availableSubAgents: [cheapest, characterGenerator, locationAgent],
  routerType: RouterType.Handoff,
};

// Agents with sub-agents should be converted to router agents
export const defaultRouter = buildRouterAgent(defaultRouterDefinition);
