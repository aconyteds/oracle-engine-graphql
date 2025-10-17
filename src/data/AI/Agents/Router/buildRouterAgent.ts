import { analyzeConversationContext, routeToAgent } from "../../Tools/routing";
import type { AIAgentDefinition } from "../../types";
import { RouterType } from "../../types";
import { buildRouterSystemMessage } from "./buildRouterSystemMessage";

/**
 * Template-based router agent translator
 * Converts AIAgentDefinition with sub-agents into router-capable agents
 */

/**
 * Translates an agent with sub-agents into a router agent
 * Only considers direct sub-agents to keep system message focused
 */
export function buildRouterAgent(agent: AIAgentDefinition): AIAgentDefinition {
  // If no sub-agents, return as-is (leaf agent)
  if (!agent.availableSubAgents?.length) {
    return {
      ...agent,
      routerType: RouterType.Simple,
    };
  }

  // Build router system message focused only on direct sub-agents
  const systemMessage = buildRouterSystemMessage(
    agent.name,
    agent.description || "Intelligent routing agent",
    agent.availableSubAgents
  );

  // Return router-enabled agent
  return {
    ...agent,
    systemMessage,
    availableTools: [routeToAgent, analyzeConversationContext],
    specialization:
      agent.specialization || "intelligent request routing and delegation",
    routerType: RouterType.Router,
  };
}
