import type { AgentPerformance, AnalysisMessage } from "./types";

/**
 * Analyzes performance of available agents based on message history.
 * Now uses the provided agent list instead of hardcoded names.
 */
export function analyzeAgentPerformance(
  messages: AnalysisMessage[],
  availableAgentNames: string[]
): Record<string, AgentPerformance> {
  const performance: Record<string, AgentPerformance> = {};

  availableAgentNames.forEach((agentName) => {
    const agentMessages = messages.filter(
      (msg) => msg.routingMetadata?.decision?.targetAgent === agentName
    );

    if (agentMessages.length === 0) {
      return; // Skip agents not used in recent history
    }

    const lastUsedIndex = messages.findLastIndex(
      (msg) => msg.routingMetadata?.decision?.targetAgent === agentName
    );
    const lastUsed =
      lastUsedIndex >= 0 ? messages.length - lastUsedIndex - 1 : 999;

    const successfulRoutes = agentMessages.filter(
      (msg) => msg.routingMetadata?.success === true
    ).length;
    const successRate =
      agentMessages.length > 0 ? successfulRoutes / agentMessages.length : 0;

    // Simple heuristic for response quality based on message length and complexity
    const avgQuality =
      agentMessages.reduce((sum, msg) => {
        const length = msg.content.length;
        const quality = Math.min(5, Math.max(1, length / 100)); // 1-5 scale
        return sum + quality;
      }, 0) / agentMessages.length || 3;

    // Determine user satisfaction based on follow-up patterns
    const userSatisfaction = determineUserSatisfaction(messages, agentMessages);

    // Check for overuse (more than 70% of recent messages)
    const overuseIndicator = agentMessages.length > messages.length * 0.7;

    performance[agentName] = {
      lastUsed,
      successRate,
      avgResponseQuality: avgQuality,
      userSatisfaction,
      overuseIndicator,
      contextMismatch: calculateContextMismatch(agentMessages),
    };
  });

  return performance;
}

/**
 * Determines user satisfaction based on follow-up message patterns.
 */
export function determineUserSatisfaction(
  allMessages: AnalysisMessage[],
  agentMessages: AnalysisMessage[]
): "positive" | "negative" | "neutral" {
  // Look for patterns in user responses after agent messages
  let positiveIndicators = 0;
  let negativeIndicators = 0;

  agentMessages.forEach((agentMsg) => {
    const agentIndex = allMessages.findIndex((msg) => msg.id === agentMsg.id);
    const followUpMsg = allMessages[agentIndex + 1];

    if (followUpMsg && followUpMsg.role === "user") {
      const content = followUpMsg.content.toLowerCase();

      // Positive indicators
      if (
        content.includes("thank") ||
        content.includes("great") ||
        content.includes("perfect") ||
        content.includes("exactly") ||
        content.includes("helpful")
      ) {
        positiveIndicators++;
      }

      // Negative indicators
      if (
        content.includes("wrong") ||
        content.includes("not what") ||
        content.includes("try again") ||
        content.includes("different") ||
        content.includes("that's not")
      ) {
        negativeIndicators++;
      }
    }
  });

  if (positiveIndicators > negativeIndicators) return "positive";
  if (negativeIndicators > positiveIndicators) return "negative";
  return "neutral";
}

/**
 * Calculates context mismatch score based on word diversity.
 */
export function calculateContextMismatch(
  agentMessages: AnalysisMessage[]
): number {
  // Simple heuristic for context mismatch based on topic consistency
  if (agentMessages.length < 2) return 0;

  // Since we're using dynamic topics now, we need a topic map
  // For simplicity, we'll use a basic word diversity metric
  const allWords = new Set<string>();
  agentMessages.forEach((msg) => {
    msg.content
      .toLowerCase()
      .split(/\s+/)
      .forEach((word) => allWords.add(word));
  });

  const avgWordsPerMessage = allWords.size / agentMessages.length;
  return Math.min(1.0, avgWordsPerMessage / 50); // Normalize to 0-1 range
}
