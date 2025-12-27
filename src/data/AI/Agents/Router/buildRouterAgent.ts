import { analyzeConversationContext, routeToAgent } from "../../Tools/routing";
import type { AIAgentDefinition } from "../../types";
import { RouterType } from "../../types";
import { buildRouterSystemMessage } from "./buildRouterSystemMessage";

/**
 * Template-based router agent translator
 * Converts AIAgentDefinition with sub-agents into router-capable agents
 */
export function buildRouterAgent(agent: AIAgentDefinition): AIAgentDefinition {
  // If no sub-agents, return as-is (leaf agent)
  if (!agent.availableSubAgents?.length) {
    return {
      ...agent,
      routerType: RouterType.None,
    };
  }

  // Build router system message focused only on direct sub-agents
  const systemMessage = buildRouterSystemMessage(
    agent.name,
    agent.description || "Intelligent routing agent",
    agent.availableSubAgents
  );

  // Return router-enabled agent
  // IMPORTANT: Preserve the original routerType from the agent definition
  // This allows the caller to specify Handoff or Controller behavior
  return {
    ...agent,
    systemMessage,
    availableTools: [routeToAgent, analyzeConversationContext],
    specialization:
      agent.specialization || "intelligent request routing and delegation",
    // Don't override routerType - use the one from the original agent definition
  };
}
