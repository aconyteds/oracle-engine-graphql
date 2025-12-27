import {
  characterGenerator,
  cheapest,
  defaultRouter,
  locationAgent,
} from "./Agents";
import type { AIAgentDefinition } from "./types";

// Initialize traditional agent list
export const AGENT_LIST = new Map<string, AIAgentDefinition>(
  [cheapest, characterGenerator, defaultRouter, locationAgent].map((agent) => [
    agent.name,
    agent,
  ])
);

export function getAgentByName(name: string): AIAgentDefinition {
  // Use traditional agent list
  const agent = AGENT_LIST.get(name);
  if (!agent) {
    throw new Error(`Agent ${name} not found`);
  }
  return agent;
}

export function getDefaultAgent(): AIAgentDefinition {
  return getAgentByName("Cheapest");
}
