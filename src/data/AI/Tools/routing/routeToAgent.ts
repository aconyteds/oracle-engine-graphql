import { tool } from "langchain";
import { z } from "zod";
import { MessageFactory } from "../../messageFactory";
import { handoffRoutingResponseSchema } from "../../schemas";
import type { RequestContext, ToolConfig } from "../../types";

type RouteToAgentInput = z.infer<typeof handoffRoutingResponseSchema>;

/**
 * A dynamic structured tool for routing user requests to the most appropriate specialized agent.
 * This tool evaluates the request based on various parameters such as confidence, reasoning,
 * intent keywords, and context factors, and returns a structured routing decision.
 *
 * This tool is designed to enhance the decision-making process in multi-agent systems by forcing
 * agents to consider a wider range of factors and collaborate more effectively.
 */
async function routeToAgentImpl(
  rawInput: RouteToAgentInput,
  config: ToolConfig
): Promise<string> {
  const input = handoffRoutingResponseSchema.parse(rawInput);
  const context = config.context as RequestContext;
  const { yieldMessage } = context;

  const {
    targetAgent,
    confidence,
    reasoning,
    fallbackAgent,
    intentKeywords,
    contextFactors,
  } = input;

  try {
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

    console.debug(
      `[route_to_agent] Decision: ${targetAgent} (${confidence}/5 confidence)`
    );
    yieldMessage(MessageFactory.reasoning(reasoning));
    console.debug(`[route_to_agent] Reasoning: ${reasoning}`);

    return JSON.stringify(routingDecision);
  } catch (error) {
    console.error("Error in route_to_agent tool:", error);
    yieldMessage(MessageFactory.error("Failed to route request"));

    return JSON.stringify({
      type: "routing_error",
      error: "Failed to process routing decision",
    });
  }
}

export const routeToAgent = tool(routeToAgentImpl, {
  name: "route_to_agent",
  description:
    "Route the user's request to the most appropriate specialized agent",
  schema: handoffRoutingResponseSchema,
});
