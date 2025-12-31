import { AGENT_LIST } from "./Agents";
import type { AIAgentDefinition } from "./types";

export function getAgentByName(name: string): AIAgentDefinition {
  // Use traditional agent list
  const agent = AGENT_LIST.get(name);
  if (!agent) {
    throw new Error(`Agent ${name} not found`);
  }
  return agent;
}

export function getDefaultAgent(): AIAgentDefinition {
  return getAgentByName("cheapest");
}
