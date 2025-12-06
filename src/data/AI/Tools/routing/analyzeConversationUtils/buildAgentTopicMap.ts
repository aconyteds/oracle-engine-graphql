import type { AIAgentDefinition } from "../../../types";
import { extractKeywordsFromSpecialization } from "./extractKeywordsFromSpecialization";

/**
 * Maps agent names to their extracted keywords and vice versa.
 * Enables bidirectional lookup: agent → keywords or keyword → agents.
 */
export interface AgentTopicMap {
  /**
   * Maps each agent name to its extracted keywords
   * @example Map { "character_generator" => ["character", "creation", "management"] }
   */
  agentToKeywords: Map<string, string[]>;

  /**
   * Maps each keyword to the agents that specialize in it
   * @example Map { "character" => ["character_generator"], "creation" => ["character_generator"] }
   */
  keywordToAgents: Map<string, string[]>;
}

/**
 * Builds a bidirectional topic map from agent specializations.
 *
 * This function extracts keywords from each agent's `specialization` property
 * and creates two maps for efficient lookup:
 * - `agentToKeywords`: Find what topics an agent handles
 * - `keywordToAgents`: Find which agents handle a given topic
 *
 * @param agents - Array of AI agent definitions
 * @returns Bidirectional topic map for agent-keyword lookups
 *
 * @example
 * ```typescript
 * const agents = [
 *   { name: "character_generator", specialization: "character creation and management", ... },
 *   { name: "location_agent", specialization: "location-based campaign assets", ... }
 * ];
 *
 * const topicMap = buildAgentTopicMap(agents);
 *
 * // Agent to keywords
 * topicMap.agentToKeywords.get("character_generator");
 * // => ["character", "creation", "management"]
 *
 * // Keyword to agents
 * topicMap.keywordToAgents.get("character");
 * // => ["character_generator"]
 * ```
 */
export function buildAgentTopicMap(agents: AIAgentDefinition[]): AgentTopicMap {
  const agentToKeywords = new Map<string, string[]>();
  const keywordToAgents = new Map<string, string[]>();

  for (const agent of agents) {
    // Extract keywords from the agent's specialization
    const keywords = extractKeywordsFromSpecialization(agent.specialization);

    // Store agent → keywords mapping
    agentToKeywords.set(agent.name, keywords);

    // Build reverse mapping: keyword → agents
    for (const keyword of keywords) {
      const existingAgents = keywordToAgents.get(keyword) || [];
      if (!existingAgents.includes(agent.name)) {
        keywordToAgents.set(keyword, [...existingAgents, agent.name]);
      }
    }
  }

  return {
    agentToKeywords,
    keywordToAgents,
  };
}
