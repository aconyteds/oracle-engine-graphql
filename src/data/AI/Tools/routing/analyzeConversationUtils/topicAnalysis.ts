import type { AgentTopicMap } from "./buildAgentTopicMap";
import type { AnalysisMessage, TopicShift } from "./types";

/**
 * Extracts the topic from a message using the dynamic topic map.
 * Matches message content against agent specialization keywords.
 */
export function extractTopicFromMessage(
  message: AnalysisMessage,
  topicMap: AgentTopicMap
): string {
  const content = message.content.toLowerCase();
  const contentWords = new Set(content.split(/\s+/));

  // Score each agent based on keyword matches
  const agentScores: Record<string, number> = {};

  for (const [keyword, agentNames] of topicMap.keywordToAgents.entries()) {
    if (contentWords.has(keyword) || content.includes(keyword)) {
      for (const agentName of agentNames) {
        agentScores[agentName] = (agentScores[agentName] || 0) + 1;
      }
    }
  }

  // Find the agent with the highest score
  const sortedAgents = Object.entries(agentScores).sort(
    ([, a], [, b]) => b - a
  );

  if (sortedAgents.length > 0 && sortedAgents[0][1] > 0) {
    // Return the agent's specialization keywords as the topic
    const topAgent = sortedAgents[0][0];
    const keywords = topicMap.agentToKeywords.get(topAgent) || [];
    return keywords.join("_");
  }

  return "general";
}

/**
 * Calculates confidence score for a topic shift between two messages.
 */
export function calculateTopicShiftConfidence(
  prevMessage: AnalysisMessage,
  currMessage: AnalysisMessage
): number {
  // Simple heuristic based on content similarity and keywords
  const prevWords = new Set(prevMessage.content.toLowerCase().split(/\s+/));
  const currWords = new Set(currMessage.content.toLowerCase().split(/\s+/));

  const intersection = new Set(
    [...prevWords].filter((word) => currWords.has(word))
  );
  const union = new Set([...prevWords, ...currWords]);

  const similarity = intersection.size / union.size;
  return Math.max(0.1, 1 - similarity); // Higher confidence for less similar messages
}

/**
 * Analyzes topic shifts across the conversation history.
 */
export function analyzeTopicShifts(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): TopicShift[] {
  const shifts: TopicShift[] = [];
  const topics = messages.map((msg) => extractTopicFromMessage(msg, topicMap));

  for (let i = 1; i < topics.length; i++) {
    if (
      topics[i] !== topics[i - 1] &&
      topics[i] !== "general" &&
      topics[i - 1] !== "general"
    ) {
      shifts.push({
        from: topics[i - 1],
        to: topics[i],
        messageIndex: i,
        confidence: calculateTopicShiftConfidence(messages[i - 1], messages[i]),
      });
    }
  }

  return shifts;
}

/**
 * Extracts the dominant topics from the conversation.
 */
export function extractDominantTopics(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): string[] {
  const topicCounts: Record<string, number> = {};

  messages.forEach((message) => {
    const topic = extractTopicFromMessage(message, topicMap);
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });

  return Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([topic]) => topic)
    .filter((topic) => topic !== "general");
}

/**
 * Calculates topic stability score (0-1, higher = more stable).
 */
export function calculateTopicStability(
  messages: AnalysisMessage[],
  topicMap: AgentTopicMap
): number {
  const topics = messages.map((msg) => extractTopicFromMessage(msg, topicMap));
  const uniqueTopics = new Set(topics.filter((t) => t !== "general"));

  if (uniqueTopics.size <= 1) return 1.0;
  if (uniqueTopics.size >= messages.length * 0.8) return 0.1;

  return Math.max(0.1, 1 - uniqueTopics.size / messages.length);
}
