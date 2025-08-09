import { cheapest, characterGenerator } from "./Agents";
import type { AIAgentDefinition } from "./types";

export const AGENT_LIST = new Map<string, AIAgentDefinition>(
  [cheapest, characterGenerator].map((agent) => [agent.name, agent])
);

export function getAgentByName(name: string): AIAgentDefinition {
  return AGENT_LIST.get(name) as AIAgentDefinition;
}

export function getDefaultAgent(): AIAgentDefinition {
  return getAgentByName("Cheapest");
}
