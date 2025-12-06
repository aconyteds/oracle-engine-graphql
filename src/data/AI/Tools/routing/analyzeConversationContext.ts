import * as Sentry from "@sentry/bun";
import { tool } from "langchain";
import { z } from "zod";
import { saveRoutingMetrics } from "../../../MongoDB/saveRoutingMetrics";
import { getAgentByName } from "../../agentList";
import { handoffRoutingResponseSchema } from "../../schemas";
import type { RequestContext } from "../../types";
import {
  type AnalysisMessage,
  analyzeAgentPerformance,
  analyzeTopicShifts,
  assessContinuityFactors,
  buildAgentTopicMap,
  type ConversationAnalysis,
  calculateTopicStability,
  extractDominantTopics,
  generateRecommendations,
  identifyConversationPatterns,
} from "./analyzeConversationUtils";

// Re-export types for external use
export type { ConversationAnalysis, AnalysisMessage };

const AnalyzeConversationContextSchema = z.object({
  currentAgentName: z
    .string()
    .describe("Name of the agent invoking this tool for routing analysis"),
  messageCount: z
    .number()
    .min(1)
    .max(10)
    .nullable()
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
            decision: handoffRoutingResponseSchema,
            executionTime: z.number(),
            success: z.boolean(),
            fallbackUsed: z.boolean(),
          })
          .nullable(),
      })
    )
    .describe("Recent message history for analysis"),
});

export type AnalyzeConversationContextInput = z.infer<
  typeof AnalyzeConversationContextSchema
>;

export const analyzeConversationContext = tool(
  async (input, config) => {
    const startTime = Date.now();
    const { currentAgentName, messageCount = 5, messages = [] } = input;
    const context = config.context as RequestContext;
    Sentry.metrics.count("tool_invocation", 1, {
      attributes: {
        tool_name: "analyze_conversation_context",
        ...context,
      },
    });

    // Validate input
    if (
      typeof messageCount !== "number" ||
      messageCount < 1 ||
      messageCount > 10
    ) {
      throw new Error("Invalid messageCount value");
    }

    let currentAgent;
    try {
      // Lookup the current agent to get its sub-agents
      currentAgent = getAgentByName(currentAgentName);
    } catch (err) {
      Sentry.captureException(err, {
        extra: {
          currentAgentName,
          context,
        },
      });
      return "Agent name not found or invalid. Cannot perform conversation analysis.";
    }

    // If the agent has no sub-agents, there's nothing to analyze for routing
    if (
      !currentAgent.availableSubAgents ||
      currentAgent.availableSubAgents.length === 0
    ) {
      const emptyAnalysis: ConversationAnalysis = {
        analysisType: "conversation_context",
        messageCount: 0,
        topicShifts: [],
        dominantTopics: [],
        topicStability: 1.0,
        agentPerformance: {},
        patterns: [],
        continuityFactors: [],
        recommendations: [
          "No sub-agents available for routing analysis - agent operates independently",
        ],
      };

      // Save metrics even for empty analysis
      const analysisTimeMs = Date.now() - startTime;
      saveRoutingMetrics({
        userId: context.userId,
        campaignId: context.campaignId,
        threadId: context.threadId,
        runId: context.runId,
        analysisTimeMs,
        messageCount: 0,
        topicStability: 1.0,
        currentAgent: currentAgentName,
        availableAgents: [],
        dominantTopics: [],
        topicShiftCount: 0,
        fullAnalysis: emptyAnalysis,
      });

      return JSON.stringify(emptyAnalysis, null, 2);
    }

    // Build topic map from available sub-agents
    const topicMap = buildAgentTopicMap(currentAgent.availableSubAgents);

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

      // Save metrics
      const analysisTimeMs = Date.now() - startTime;
      saveRoutingMetrics({
        userId: context.userId,
        campaignId: context.campaignId,
        threadId: context.threadId,
        runId: context.runId,
        analysisTimeMs,
        messageCount: 0,
        topicStability: 1.0,
        currentAgent: currentAgentName,
        availableAgents: currentAgent.availableSubAgents.map((a) => a.name),
        dominantTopics: [],
        topicShiftCount: 0,
        fullAnalysis: emptyAnalysis,
      });

      return JSON.stringify(emptyAnalysis, null, 2);
    }

    const recentMessages = messages.slice(-messageCount);

    const analysis: ConversationAnalysis = {
      analysisType: "conversation_context",
      messageCount: recentMessages.length,
      topicShifts: analyzeTopicShifts(recentMessages, topicMap),
      dominantTopics: extractDominantTopics(recentMessages, topicMap),
      topicStability: calculateTopicStability(recentMessages, topicMap),
      agentPerformance: analyzeAgentPerformance(
        recentMessages,
        currentAgent.availableSubAgents.map((a) => a.name)
      ),
      patterns: identifyConversationPatterns(recentMessages, topicMap),
      continuityFactors: assessContinuityFactors(recentMessages, topicMap),
      recommendations: [],
    };

    // Generate recommendations based on analysis
    analysis.recommendations = generateRecommendations(analysis);

    // Save metrics (fire-and-forget, non-blocking)
    const analysisTimeMs = Date.now() - startTime;
    saveRoutingMetrics({
      userId: context.userId,
      campaignId: context.campaignId,
      threadId: context.threadId,
      runId: context.runId,
      analysisTimeMs,
      messageCount: analysis.messageCount,
      topicStability: analysis.topicStability,
      currentAgent: currentAgentName,
      availableAgents: currentAgent.availableSubAgents.map((a) => a.name),
      dominantTopics: analysis.dominantTopics,
      topicShiftCount: analysis.topicShifts.length,
      fullAnalysis: analysis,
    });

    return JSON.stringify(analysis, null, 2);
  },
  {
    name: "analyzeConversationContext",
    description:
      "Analyze recent conversation history for context clues that influence routing decisions based on available sub-agents",
    schema: AnalyzeConversationContextSchema,
  }
);
