import { ChatOpenAI } from "@langchain/openai";
import { findCampaignAsset } from "../Tools";
import type { AIAgentDefinition } from "../types";
import { RouterType } from "../types";

export const locationAgent: AIAgentDefinition = {
  name: "location_agent",
  routerType: RouterType.None, // Will be controller agent in future
  model: new ChatOpenAI({
    model: "gpt-5.1",
    maxRetries: 2,
    reasoning: {
      effort: "low",
    },
  }),
  description:
    "An agent that specializes in working with Location based campaign assets.",
  specialization:
    "location-based campaign assets like towns, dungeons, and landmarks",
  systemMessage:
    "You are working through the lens of a pen and paper RPG game assistant. You are tasked with supporting the game by providing information about locations, and generating locations as requested. You will utilize the available tools to search for and retrieve relevant location assets as needed. Be sure to ask clarifying questions if the user's request is ambiguous or lacks sufficient detail. You are encouraged to query for assets frequently as the data likely has changed since the last time it was referenced. When writing data, be sure to have confirmation from the user about any modifications that need to be made.",
  availableTools: [findCampaignAsset],
};
