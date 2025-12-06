import type { ConversationAnalysis } from "../AI/Tools/routing/analyzeConversationUtils";
import { DBClient } from "./client";

/**
 * Parameters for saving routing metrics to MongoDB.
 * All fields are required to ensure complete metric tracking.
 */
export interface SaveRoutingMetricsParams {
  // Context identifiers
  userId: string;
  campaignId: string;
  threadId: string;
  runId: string;

  // Basic metrics
  analysisTimeMs: number;
  messageCount: number;
  topicStability: number;

  // Agent information
  currentAgent: string;
  availableAgents: string[];

  // Topic analysis
  dominantTopics: string[];
  topicShiftCount: number;

  // Full analysis object
  fullAnalysis: ConversationAnalysis;
}

/**
 * Saves routing analysis metrics to MongoDB.
 *
 * This function uses a fire-and-forget pattern to ensure it never blocks
 * the routing analysis process. The database call is not awaited, and any
 * errors are silently caught and logged.
 *
 * **Non-blocking pattern:**
 * - Returns `void` immediately
 * - Database call happens asynchronously
 * - Errors are caught and logged, never thrown
 * - Never impacts routing performance
 *
 * **All data is saved:**
 * - No sampling - complete analysis is always stored
 * - Includes detailed JSON for agent performance, patterns, topic shifts
 * - Links to LangSmith traces via `runId`
 *
 * @param input - Routing metrics and analysis results
 *
 * @example
 * ```typescript
 * // Fire-and-forget - no await needed
 * saveRoutingMetrics({
 *   userId: context.userId,
 *   campaignId: context.campaignId,
 *   threadId: context.threadId,
 *   runId: context.runId,
 *   analysisTimeMs: 45.2,
 *   messageCount: 5,
 *   topicStability: 0.85,
 *   currentAgent: "default_router",
 *   availableAgents: ["cheapest", "character_generator"],
 *   dominantTopics: ["character", "creation"],
 *   topicShiftCount: 2,
 *   fullAnalysis: analysis,
 * });
 * // Execution continues immediately
 * ```
 */
export function saveRoutingMetrics(input: SaveRoutingMetricsParams): void {
  // Fire and forget - don't await the database call
  DBClient.routingMetric
    .create({
      data: {
        // Context identifiers
        userId: input.userId,
        campaignId: input.campaignId,
        threadId: input.threadId,
        runId: input.runId,

        // Basic metrics
        analysisTimeMs: input.analysisTimeMs,
        messageCount: input.messageCount,
        topicStability: input.topicStability,

        // Agent information
        currentAgent: input.currentAgent,
        availableAgents: input.availableAgents,

        // Topic analysis
        dominantTopics: input.dominantTopics,
        topicShiftCount: input.topicShiftCount,

        // Detailed analysis JSON (cast to any for Prisma JSON type compatibility)
        // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
        agentPerformanceJson: input.fullAnalysis.agentPerformance as any,
        // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
        patternsJson: input.fullAnalysis.patterns as any,
        // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
        topicShiftsJson: input.fullAnalysis.topicShifts as any,
        // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
        continuityFactorsJson: input.fullAnalysis.continuityFactors as any,
        // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
        recommendationsJson: input.fullAnalysis.recommendations as any,
      },
    })
    .catch((error) => {
      // Silent failure - metrics should never break the application
      console.error("Routing metrics save failed:", error);
    });
}
