import type { AIAgentDefinition } from "../../types";

/**
 * Build descriptions of direct sub-agents only
 */
export function buildSubAgentDescriptions(
  subAgents: AIAgentDefinition[]
): string {
  return subAgents
    .map((agent) => {
      const agentType = agent.availableSubAgents?.length
        ? "Router Agent"
        : "Specialized Agent";
      const subAgentInfo = agent.availableSubAgents?.length
        ? ` (Routes to ${agent.availableSubAgents.length} sub-agents)`
        : "";

      return `- "${agent.name}" (${agentType}): ${agent.description}${subAgentInfo}`;
    })
    .join("\n");
}
