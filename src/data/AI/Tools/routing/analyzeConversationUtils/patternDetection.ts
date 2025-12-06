import type { AgentTopicMap } from "./buildAgentTopicMap";
import { extractTopicFromMessage } from "./topicAnalysis";
import type { AnalysisMessage, ConversationPattern } from "./types";

/**
 * Identifies conversation patterns that influence routing decisions.
 */
export function identifyConversationPatterns(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): ConversationPattern[] {
  const patterns: ConversationPattern[] = [];

  // Check for escalating complexity
  const complexityPattern = detectEscalatingComplexity(messages);
  if (complexityPattern) patterns.push(complexityPattern);

  // Check for repeated failures
  const failurePattern = detectRepeatedFailures(messages);
  if (failurePattern) patterns.push(failurePattern);

  // Check for workflow continuation
  const workflowPattern = detectWorkflowContinuation(messages, topicMap);
  if (workflowPattern) patterns.push(workflowPattern);

  // Check for topic drift
  const driftPattern = detectTopicDrift(messages, topicMap);
  if (driftPattern) patterns.push(driftPattern);

  return patterns;
}

/**
 * Detects escalating complexity in user requests.
 */
export function detectEscalatingComplexity(
  messages: AnalysisMessage[]
): ConversationPattern | null {
  // Look for increasing message length and technical terms
  const userMessages = messages.filter((msg) => msg.role === "user");
  if (userMessages.length < 3) return null;

  const complexityScores = userMessages.map((msg) => {
    const length = msg.content.length;
    const technicalTerms = (
      msg.content.match(/\b(implement|configure|optimize|debug|analyze)\b/gi) ||
      []
    ).length;
    return length + technicalTerms * 50;
  });

  const isEscalating = complexityScores
    .slice(-3)
    .every((score, i, arr) => i === 0 || score > arr[i - 1]);

  if (isEscalating) {
    return {
      type: "escalating_complexity",
      description:
        "User requests are becoming increasingly complex and technical",
      confidence: 0.8,
      recommendation: "route_to_specialist",
    };
  }

  return null;
}

/**
 * Detects repeated routing failures.
 */
export function detectRepeatedFailures(
  messages: AnalysisMessage[]
): ConversationPattern | null {
  const failureCount = messages.filter(
    (msg) => msg.routingMetadata?.success === false
  ).length;

  if (failureCount >= 2) {
    return {
      type: "repeated_failures",
      description: `Multiple routing failures detected (${failureCount} failures)`,
      confidence: 0.9,
      recommendation: "try_different_agent",
      failureCount,
    };
  }

  return null;
}

/**
 * Detects workflow continuation using dynamic topic keywords.
 * Now uses the topic map to identify workflows automatically.
 */
export function detectWorkflowContinuation(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): ConversationPattern | null {
  // Get all keywords from all agents
  const allKeywords = new Set<string>();
  for (const keywords of topicMap.agentToKeywords.values()) {
    keywords.forEach((k) => allKeywords.add(k));
  }

  // Count keyword mentions in recent messages
  const keywordMentions: Record<string, number> = {};
  messages.slice(-5).forEach((msg) => {
    const content = msg.content.toLowerCase();
    allKeywords.forEach((keyword) => {
      if (content.includes(keyword)) {
        keywordMentions[keyword] = (keywordMentions[keyword] || 0) + 1;
      }
    });
  });

  // Find the most mentioned keyword group
  const sortedKeywords = Object.entries(keywordMentions).sort(
    ([, a], [, b]) => b - a
  );

  if (sortedKeywords.length > 0 && sortedKeywords[0][1] >= 3) {
    const dominantKeyword = sortedKeywords[0][0];

    // Find which agent this keyword belongs to
    const agents = topicMap.keywordToAgents.get(dominantKeyword) || [];

    if (agents.length > 0) {
      return {
        type: "session_flow",
        description: `User appears to be in the middle of a ${dominantKeyword}-related workflow`,
        confidence: 0.85,
        recommendation: "maintain_current_agent",
        currentStep: dominantKeyword,
      };
    }
  }

  return null;
}

/**
 * Detects topic drift across the conversation.
 */
export function detectTopicDrift(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): ConversationPattern | null {
  const topics = messages.map((msg) => extractTopicFromMessage(msg, topicMap));
  const uniqueTopics = new Set(topics.filter((t) => t !== "general"));

  if (uniqueTopics.size > messages.length * 0.6) {
    return {
      type: "topic_drift",
      description:
        "Conversation topics are changing frequently without clear focus",
      confidence: 0.7,
      recommendation: "try_different_agent",
    };
  }

  return null;
}
