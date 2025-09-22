import { getModelByName } from "../modelList";
import { characterStatsGenerator, nameGenerator } from "../Tools";
import type { AIAgentDefinition } from "../types";

export const characterGenerator: AIAgentDefinition = {
  name: "Character Generator",
  routerType: "simple",
  model: getModelByName("gpt-4.1-nano"),
  description: "An Agent which has the ability to create characters.",
  systemMessage:
    "You are a Dungeon Master's assistant who helps create and manage characters. You will work to make the necessary tool calls to fulfill the user's request with regards to characters.",
  availableTools: [characterStatsGenerator, nameGenerator],
  specialization: "character creation and management",
};
