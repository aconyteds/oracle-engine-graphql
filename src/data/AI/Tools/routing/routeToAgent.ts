import * as Sentry from "@sentry/bun";
import { tool } from "langchain";
import { handoffRoutingResponseSchema } from "../../schemas";

/**
 * A dynamic structured tool for routing user requests to the most appropriate specialized agent.
 * This tool evaluates the request based on various parameters such as confidence, reasoning,
 * intent keywords, and context factors, and returns a structured routing decision.
 *
 * This tool is designed to enhance the decision-making process in multi-agent systems by forcing
 * agents to consider a wider range of factors and collaborate more effectively.
 */
export const routeToAgent = tool(
  async (input, context) => {
    const {
      targetAgent,
      confidence,
      reasoning,
      fallbackAgent,
      intentKeywords,
      contextFactors,
    } = input;
    Sentry.metrics.count("tool_invocation", 1, {
      attributes: {
        tool_name: "route_to_agent",
        ...context,
      },
    });

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
      `Routing Decision: ${targetAgent} (${confidence} confidence)`
    );
    console.debug(`Reasoning: ${reasoning}`);

    return JSON.stringify(routingDecision);
  },
  {
    name: "routeToAgent",
    description:
      "Route the user's request to the most appropriate specialized agent",
    schema: handoffRoutingResponseSchema,
  }
);
