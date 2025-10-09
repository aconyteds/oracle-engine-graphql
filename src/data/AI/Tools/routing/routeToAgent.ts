import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * A dynamic structured tool for routing user requests to the most appropriate specialized agent.
 * This tool evaluates the request based on various parameters such as confidence, reasoning,
 * intent keywords, and context factors, and returns a structured routing decision.
 *
 * This tool is designed to enhance the decision-making process in multi-agent systems by forcing
 * agents to consider a wider range of factors and collaborate more effectively.
 */
const routingSchema = z.object({
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
});

export const routeToAgent = new DynamicStructuredTool({
  name: "routeToAgent",
  description:
    "Route the user's request to the most appropriate specialized agent",
  schema: routingSchema,
  func: (rawInput: unknown): Promise<string> => {
    const {
      targetAgent,
      confidence,
      reasoning,
      fallbackAgent,
      intentKeywords,
      contextFactors,
    } = routingSchema.parse(rawInput);
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
      `🎯 Routing Decision: ${targetAgent} (${confidence} confidence)`
    );
    console.log(`📝 Reasoning: ${reasoning}`);

    return Promise.resolve(JSON.stringify(routingDecision));
  },
});
