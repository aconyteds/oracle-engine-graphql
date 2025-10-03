import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const AnalyzeConversationContextSchema = z.object({
  messageCount: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("Number of recent messages to analyze"),
  messages: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        createdAt: z.string().describe("ISO timestamp"),
        routingMetadata: z
          .object({
            decision: z
              .object({
                targetAgent: z.string(),
                confidence: z.number(),
                reasoning: z.string(),
                fallbackAgent: z.string().optional(),
                intentKeywords: z.array(z.string()),
                contextFactors: z.array(z.string()).optional(),
              })
              .nullable(),
            executionTime: z.number(),
            success: z.boolean(),
            fallbackUsed: z.boolean(),
          })
          .nullable()
          .optional(),
      })
    )
    .optional()
    .describe("Recent message history for analysis"),
});

export type AnalyzeConversationContextInput = z.infer<
  typeof AnalyzeConversationContextSchema
>;

// Message type for analysis
export interface AnalysisMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  createdAt: string;
  routingMetadata?: {
    decision?: {
      targetAgent: string;
      confidence: number;
      reasoning: string;
      fallbackAgent?: string;
      intentKeywords: string[];
      contextFactors?: string[];
    } | null;
    executionTime: number;
    success: boolean;
    fallbackUsed: boolean;
  } | null;
}

// Analysis result types
export interface TopicShift {
  from: string;
  to: string;
  messageIndex: number;
  confidence: number;
}

export interface AgentPerformance {
  lastUsed: number; // messages ago
  successRate: number;
  avgResponseQuality: number;
  userSatisfaction: "positive" | "negative" | "neutral";
  overuseIndicator?: boolean;
  contextMismatch?: number;
}

export interface ConversationPattern {
  type:
    | "escalating_complexity"
    | "repeated_failures"
    | "session_flow"
    | "topic_drift"
    | "workflow_continuation";
  description: string;
  confidence: number;
  recommendation:
    | "route_to_specialist"
    | "try_different_agent"
    | "maintain_current_agent"
    | "escalate_to_human";
  failureCount?: number;
  currentStep?: string;
}

export interface ContinuityFactor {
  type:
    | "active_workflow"
    | "knowledge_buildup"
    | "user_preference"
    | "session_state";
  workflow?: string;
  completionPercentage?: number;
  contextValue?: "high" | "medium" | "low";
  description: string;
  recommendation:
    | "maintain_current_agent"
    | "prefer_current_agent"
    | "allow_agent_switch";
}

export interface ConversationAnalysis {
  analysisType: "conversation_context";
  messageCount: number;
  topicShifts: TopicShift[];
  dominantTopics: string[];
  topicStability: number;
  agentPerformance: Record<string, AgentPerformance>;
  patterns: ConversationPattern[];
  continuityFactors: ContinuityFactor[];
  recommendations: string[];
}

export const analyzeConversationContext = new DynamicStructuredTool({
  name: "analyzeConversationContext",
  description:
    "Analyze recent conversation history for context clues that influence routing decisions",
  schema: AnalyzeConversationContextSchema,
  func: (rawInput: unknown): Promise<string> => {
    const input = AnalyzeConversationContextSchema.parse(rawInput);
    const { messageCount = 5, messages = [] } = input;

    // Validate input
    if (
      typeof messageCount !== "number" ||
      messageCount < 1 ||
      messageCount > 10
    ) {
      throw new Error("Invalid messageCount value");
    }

    // If no messages provided, return empty analysis
    if (messages.length === 0) {
      const emptyAnalysis: ConversationAnalysis = {
        analysisType: "conversation_context",
        messageCount: 0,
        topicShifts: [],
        dominantTopics: [],
        topicStability: 1.0,
        agentPerformance: {},
        patterns: [],
        continuityFactors: [],
        recommendations: ["No conversation history available for analysis"],
      };
      return Promise.resolve(JSON.stringify(emptyAnalysis, null, 2));
    }

    const recentMessages = messages.slice(-messageCount);

    const analysis: ConversationAnalysis = {
      analysisType: "conversation_context",
      messageCount: recentMessages.length,
      topicShifts: analyzeTopicShifts(recentMessages),
      dominantTopics: extractDominantTopics(recentMessages),
      topicStability: calculateTopicStability(recentMessages),
      agentPerformance: analyzeAgentPerformance(recentMessages),
      patterns: identifyConversationPatterns(recentMessages),
      continuityFactors: assessContinuityFactors(recentMessages),
      recommendations: [],
    };

    // Generate recommendations based on analysis
    analysis.recommendations = generateRecommendations(analysis);

    return Promise.resolve(JSON.stringify(analysis, null, 2));
  },
});

function analyzeTopicShifts(messages: AnalysisMessage[]): TopicShift[] {
  const shifts: TopicShift[] = [];
  const topics = messages.map(extractTopicFromMessage);

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

function extractTopicFromMessage(message: AnalysisMessage): string {
  const content = message.content.toLowerCase();

  // RPG/D&D topics
  if (
    content.includes("character") ||
    content.includes("stats") ||
    content.includes("ability")
  ) {
    return "character_creation";
  }
  if (
    content.includes("combat") ||
    content.includes("attack") ||
    content.includes("damage")
  ) {
    return "combat_rules";
  }
  if (
    content.includes("spell") ||
    content.includes("magic") ||
    content.includes("cast")
  ) {
    return "magic_spells";
  }
  if (
    content.includes("campaign") ||
    content.includes("story") ||
    content.includes("adventure")
  ) {
    return "campaign_management";
  }

  // General topics
  if (
    content.includes("help") ||
    content.includes("support") ||
    content.includes("problem")
  ) {
    return "technical_support";
  }
  if (
    content.includes("calculate") ||
    content.includes("math") ||
    content.includes("number")
  ) {
    return "calculations";
  }

  return "general";
}

function calculateTopicShiftConfidence(
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

function extractDominantTopics(messages: AnalysisMessage[]): string[] {
  const topicCounts: Record<string, number> = {};

  messages.forEach((message) => {
    const topic = extractTopicFromMessage(message);
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });

  return Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([topic]) => topic)
    .filter((topic) => topic !== "general");
}

function calculateTopicStability(messages: AnalysisMessage[]): number {
  const topics = messages.map(extractTopicFromMessage);
  const uniqueTopics = new Set(topics.filter((t) => t !== "general"));

  if (uniqueTopics.size <= 1) return 1.0;
  if (uniqueTopics.size >= messages.length * 0.8) return 0.1;

  return Math.max(0.1, 1 - uniqueTopics.size / messages.length);
}

function analyzeAgentPerformance(
  messages: AnalysisMessage[]
): Record<string, AgentPerformance> {
  const performance: Record<string, AgentPerformance> = {};

  // Known agents from the system
  const knownAgents = ["Cheapest", "Character Generator"];

  knownAgents.forEach((agentName) => {
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

function determineUserSatisfaction(
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

function calculateContextMismatch(agentMessages: AnalysisMessage[]): number {
  // Simple heuristic for context mismatch based on topic consistency
  if (agentMessages.length < 2) return 0;

  const topics = agentMessages.map(extractTopicFromMessage);
  const uniqueTopics = new Set(topics);

  return uniqueTopics.size / topics.length; // Higher = more topic inconsistency
}

function identifyConversationPatterns(
  messages: AnalysisMessage[]
): ConversationPattern[] {
  const patterns: ConversationPattern[] = [];

  // Check for escalating complexity
  const complexityPattern = detectEscalatingComplexity(messages);
  if (complexityPattern) patterns.push(complexityPattern);

  // Check for repeated failures
  const failurePattern = detectRepeatedFailures(messages);
  if (failurePattern) patterns.push(failurePattern);

  // Check for workflow continuation
  const workflowPattern = detectWorkflowContinuation(messages);
  if (workflowPattern) patterns.push(workflowPattern);

  // Check for topic drift
  const driftPattern = detectTopicDrift(messages);
  if (driftPattern) patterns.push(driftPattern);

  return patterns;
}

function detectEscalatingComplexity(
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

function detectRepeatedFailures(
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

function detectWorkflowContinuation(
  messages: AnalysisMessage[]
): ConversationPattern | null {
  // Look for character creation workflow
  const characterKeywords = [
    "character",
    "stats",
    "ability",
    "background",
    "class",
    "race",
  ];
  const recentCharacterMentions = messages
    .slice(-5)
    .filter((msg) =>
      characterKeywords.some((keyword) =>
        msg.content.toLowerCase().includes(keyword)
      )
    ).length;

  if (recentCharacterMentions >= 3) {
    return {
      type: "session_flow",
      description:
        "User appears to be in the middle of a character creation workflow",
      confidence: 0.85,
      recommendation: "maintain_current_agent",
      currentStep: "character_creation",
    };
  }

  return null;
}

function detectTopicDrift(
  messages: AnalysisMessage[]
): ConversationPattern | null {
  const topics = messages.map(extractTopicFromMessage);
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

function assessContinuityFactors(
  messages: AnalysisMessage[]
): ContinuityFactor[] {
  const factors: ContinuityFactor[] = [];

  // Check for active workflows
  const workflowFactor = assessActiveWorkflow(messages);
  if (workflowFactor) factors.push(workflowFactor);

  // Check for knowledge buildup
  const knowledgeFactor = assessKnowledgeBuildup(messages);
  if (knowledgeFactor) factors.push(knowledgeFactor);

  // Check for user preferences
  const preferenceFactor = assessUserPreferences(messages);
  if (preferenceFactor) factors.push(preferenceFactor);

  return factors;
}

function assessActiveWorkflow(
  messages: AnalysisMessage[]
): ContinuityFactor | null {
  const characterWorkflowKeywords = [
    "character",
    "stats",
    "background",
    "class",
  ];
  const workflowMessages = messages.filter((msg) =>
    characterWorkflowKeywords.some((keyword) =>
      msg.content.toLowerCase().includes(keyword)
    )
  );

  if (workflowMessages.length >= 2) {
    const completion = Math.min(1.0, workflowMessages.length / 5); // Assume 5 steps for character creation

    return {
      type: "active_workflow",
      workflow: "character_creation",
      completionPercentage: completion,
      description: `Character creation workflow is ${Math.round(completion * 100)}% complete`,
      recommendation:
        completion > 0.7 ? "maintain_current_agent" : "prefer_current_agent",
    };
  }

  return null;
}

function assessKnowledgeBuildup(
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

function assessUserPreferences(
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

function generateRecommendations(analysis: ConversationAnalysis): string[] {
  const recommendations: string[] = [];

  // Topic stability recommendations
  if (analysis.topicStability < 0.3) {
    recommendations.push(
      "Consider using a generalist agent due to topic instability"
    );
  } else if (
    analysis.topicStability > 0.8 &&
    analysis.dominantTopics.length > 0
  ) {
    recommendations.push(
      `Maintain focus on ${analysis.dominantTopics[0]} with specialized agent`
    );
  }

  // Agent performance recommendations
  Object.entries(analysis.agentPerformance).forEach(([agent, perf]) => {
    if (perf.overuseIndicator) {
      recommendations.push(
        `Consider diversifying from ${agent} to prevent overuse`
      );
    }
    if (perf.successRate < 0.5) {
      recommendations.push(
        `${agent} showing low success rate, consider alternatives`
      );
    }
    if (perf.userSatisfaction === "negative") {
      recommendations.push(
        `User dissatisfaction detected with ${agent}, try different approach`
      );
    }
  });

  // Pattern-based recommendations
  analysis.patterns.forEach((pattern) => {
    recommendations.push(
      `${pattern.type}: ${pattern.description} - ${pattern.recommendation}`
    );
  });

  // Continuity recommendations
  analysis.continuityFactors.forEach((factor) => {
    recommendations.push(
      `${factor.type}: ${factor.description} - ${factor.recommendation}`
    );
  });

  return recommendations.length > 0
    ? recommendations
    : ["Continue with current routing approach"];
}
