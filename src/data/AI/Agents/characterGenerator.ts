import { ChatOpenAI } from "@langchain/openai";
import { characterStatsGenerator } from "../Tools";
import type { AIAgentDefinition } from "../types";
import { RouterType } from "../types";

export const characterGenerator: AIAgentDefinition = {
  name: "character_generator",
  routerType: RouterType.None,
  model: new ChatOpenAI({
    model: "gpt-5-nano",
    maxRetries: 0,
    reasoning: {
      effort: "minimal",
    },
  }),
  description: "An Agent which has the ability to create characters.",
  systemMessage:
    "You are a Dungeon Master's assistant who helps create and manage characters. You will work to make the necessary tool calls to fulfill the user's request with regards to characters.",
  availableTools: [characterStatsGenerator],
  specialization: "character creation and management",
};
