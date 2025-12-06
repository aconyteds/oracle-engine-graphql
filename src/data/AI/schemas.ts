import { z } from "zod";

/**
 * Context schema for agent execution
 */
export const agentContextSchema = z.object({
  campaignId: z.string().describe("The DB ID of the campaign."),
  userId: z.string().describe("The DB ID of the user making the request."),
  threadId: z.string().describe("The DB ID of the thread being processed."),
  runId: z.string().describe("The unique ID for this workflow run."),
});

export type AgentContextSchema = z.infer<typeof agentContextSchema>;

/**
 * Structured response schema for handoff routers
 */
export const handoffRoutingResponseSchema = z.object({
  targetAgent: z
    .string()
    .describe("Name of the target agent (must match exactly)"),
  confidence: z
    .number()
    .min(0)
    .max(5)
    .describe("Confidence level 0-5 for routing decision"),
  reasoning: z
    .string()
    .min(10)
    .describe("Detailed explanation for why this agent was chosen"),
  fallbackAgent: z.string().describe("Fallback agent if primary choice fails"),
  intentKeywords: z
    .array(z.string())
    .describe("Key terms that influenced routing decision"),
  contextFactors: z
    .array(z.string())
    .describe("Conversation context factors considered"),
});

export type HandoffRoutingResponse = z.infer<
  typeof handoffRoutingResponseSchema
>;
