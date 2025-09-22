import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const routeToAgent = new DynamicStructuredTool({
  name: "routeToAgent",
  description:
    "Route the user's request to the most appropriate specialized agent",
  schema: z.object({
    targetAgent: z
      .string()
      .describe("Name of the target agent (must match exactly)"),
    confidence: z
      .number()
      .min(0)
      .max(100)
      .describe("Confidence level 0-100 for routing decision"),
    reasoning: z
      .string()
      .min(10)
      .describe("Detailed explanation for why this agent was chosen"),
    fallbackAgent: z
      .string()
      .optional()
      .describe("Fallback agent if primary choice fails"),
    intentKeywords: z
      .array(z.string())
      .describe("Key terms that influenced routing decision"),
    contextFactors: z
      .array(z.string())
      .optional()
      .describe("Conversation context factors considered"),
  }),
  func: async ({
    targetAgent,
    confidence,
    reasoning,
    fallbackAgent,
    intentKeywords,
    contextFactors,
  }: {
    targetAgent: string;
    confidence: number;
    reasoning: string;
    fallbackAgent?: string;
    intentKeywords: string[];
    contextFactors?: string[];
  }) => {
    const routingDecision = {
      type: "routing_decision",
      targetAgent,
      confidence,
      reasoning,
      fallbackAgent,
      intentKeywords,
      contextFactors: contextFactors || [],
      timestamp: new Date().toISOString(),
    };

    console.log(
      `🎯 Routing Decision: ${targetAgent} (${confidence}% confidence)`
    );
    console.log(`📝 Reasoning: ${reasoning}`);

    return JSON.stringify(routingDecision);
  },
});
