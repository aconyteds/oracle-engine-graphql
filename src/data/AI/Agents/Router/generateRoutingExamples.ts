import type { AIAgentDefinition } from "../../types";

/**
 * Generate routing examples based on direct sub-agents only
 */
export function generateRoutingExamples(
  subAgents: AIAgentDefinition[]
): string {
  const examples: string[] = [];

  for (const agent of subAgents) {
    // Use agent's own routing examples if provided
    if (agent.routingExamples?.length) {
      agent.routingExamples.forEach((example) => {
        examples.push(
          `- "${example.userRequest}" → ${agent.name} (confidence: ${example.confidence})`
        );
      });
    } else {
      // Fallback: generate basic example from specialization or description
      const confidence = agent.availableSubAgents?.length ? 2 : 3; // Lower for routers
      const specialty =
        agent.specialization || agent.description || "relevant requests";
      examples.push(
        `- "Help me with ${specialty}" → ${agent.name} (confidence: ${confidence})`
      );
    }
  }

  return examples.length
    ? examples.join("\n")
    : "- Route based on request content and agent capabilities";
}
