import type { AgentTopicMap } from "./buildAgentTopicMap";
import type { AnalysisMessage, ContinuityFactor } from "./types";

/**
 * Assesses continuity factors that influence agent persistence.
 */
export function assessContinuityFactors(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): ContinuityFactor[] {
  const factors: ContinuityFactor[] = [];

  // Check for active workflows
  const workflowFactor = assessActiveWorkflow(messages, topicMap);
  if (workflowFactor) factors.push(workflowFactor);

  // Check for knowledge buildup
  const knowledgeFactor = assessKnowledgeBuildup(messages);
  if (knowledgeFactor) factors.push(knowledgeFactor);

  // Check for user preferences
  const preferenceFactor = assessUserPreferences(messages);
  if (preferenceFactor) factors.push(preferenceFactor);

  return factors;
}

/**
 * Assesses active workflows using dynamic topic keywords from the topic map.
 */
export function assessActiveWorkflow(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): ContinuityFactor | null {
  // Get all keywords from all agents
  const allKeywords = new Set<string>();
  for (const keywords of topicMap.agentToKeywords.values()) {
    keywords.forEach((k) => allKeywords.add(k));
  }

  // Count keyword mentions
  const keywordMentions: Record<string, number> = {};
  messages.forEach((msg) => {
    const content = msg.content.toLowerCase();
    allKeywords.forEach((keyword) => {
      if (content.includes(keyword)) {
        keywordMentions[keyword] = (keywordMentions[keyword] || 0) + 1;
      }
    });
  });

  const sortedKeywords = Object.entries(keywordMentions).sort(
    ([, a], [, b]) => b - a
  );

  if (sortedKeywords.length > 0 && sortedKeywords[0][1] >= 2) {
    const dominantKeyword = sortedKeywords[0][0];
    const mentionCount = sortedKeywords[0][1];

    // Estimate completion based on mention frequency (assume 5 mentions = complete)
    const completion = Math.min(1.0, mentionCount / 5);

    return {
      type: "active_workflow",
      workflow: dominantKeyword,
      completionPercentage: completion,
      description: `${dominantKeyword} workflow is ${Math.round(completion * 100)}% complete`,
      recommendation:
        completion > 0.7 ? "maintain_current_agent" : "prefer_current_agent",
    };
  }

  return null;
}

/**
 * Assesses knowledge buildup in the conversation.
 */
export function assessKnowledgeBuildup(
  messages: AnalysisMessage[]
): ContinuityFactor | null {
  // Look for continuity in assistant responses
  const assistantMessages = messages.filter((msg) => msg.role === "assistant");

  if (assistantMessages.length >= 3) {
    const avgLength =
      assistantMessages.reduce((sum, msg) => sum + msg.content.length, 0) /
      assistantMessages.length;
    const contextValue =
      avgLength > 500 ? "high" : avgLength > 200 ? "medium" : "low";

    return {
      type: "knowledge_buildup",
      contextValue,
      description: `Assistant has built ${contextValue} context about the conversation`,
      recommendation:
        contextValue === "high"
          ? "maintain_current_agent"
          : "prefer_current_agent",
    };
  }

  return null;
}

/**
 * Assesses user preference indicators.
 */
export function assessUserPreferences(
  messages: AnalysisMessage[]
): ContinuityFactor | null {
  const userMessages = messages.filter((msg) => msg.role === "user");
  const preferenceIndicators = userMessages.filter(
    (msg) =>
      msg.content.toLowerCase().includes("prefer") ||
      msg.content.toLowerCase().includes("like") ||
      msg.content.toLowerCase().includes("continue")
  );

  if (preferenceIndicators.length > 0) {
    return {
      type: "user_preference",
      description:
        "User has expressed preferences for current interaction style",
      recommendation: "prefer_current_agent",
    };
  }

  return null;
}
