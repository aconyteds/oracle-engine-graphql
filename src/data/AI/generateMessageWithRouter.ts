import type { BaseMessage } from "@langchain/core/messages";
import type { GenerateMessagePayload } from "../../generated/graphql";
import { TranslateMessage } from "../../modules/utils";
import { logger } from "../../utils/logger";
import type { MessageWorkspace } from "../MongoDB";
import { saveMessage } from "../MongoDB";
import type { AIAgentDefinition, RoutingMetadata } from "./types";
import { runRouterWorkflow } from "./Workflows/routerWorkflow";

export type GenerateMessageWithRouterProps = {
  threadId: string;
  agent: AIAgentDefinition;
  messageHistory: BaseMessage[];
  runId: string;
};

export async function* generateMessageWithRouter({
  threadId,
  agent,
  messageHistory,
  runId,
}: GenerateMessageWithRouterProps): AsyncGenerator<GenerateMessagePayload> {
  const startTime = Date.now();

  try {
    yield {
      responseType: "Debug",
      content: "🎯 Analyzing request for optimal agent routing...",
    };

    // Execute router workflow
    const routerResult = await runRouterWorkflow({
      messages: messageHistory,
      threadId: runId,
      agent,
    });

    const workspaceEntries: MessageWorkspace[] = [];

    // Add routing analysis to workspace
    if (routerResult.routingDecision) {
      const decision = routerResult.routingDecision;
      const targetAgentName = decision.targetAgent.name;

      yield {
        responseType: "Intermediate",
        content: `🤖 Routing to ${targetAgentName} (${decision.confidence}% confidence)`,
      };

      workspaceEntries.push({
        messageType: "routing",
        content: `Routed to: ${targetAgentName} with ${decision.confidence}% confidence. Reasoning: ${decision.reasoning}`,
        timestamp: decision.routedAt,
        elapsedTime: routerResult.routingMetadata?.executionTime || 0,
      });
    }

    // Return the final response from the routed agent with routing metadata
    if (routerResult.currentResponse) {
      const routingMetadata: RoutingMetadata | undefined =
        routerResult.routingMetadata
          ? {
              ...routerResult.routingMetadata,
              executionTime: Date.now() - startTime,
            }
          : undefined;

      const savedMessage = await saveMessage({
        threadId,
        content: routerResult.currentResponse,
        role: "assistant",
        workspace: workspaceEntries,
        runId: routerResult.runId,
        routingMetadata: routingMetadata as unknown as Record<string, unknown>, // Cast to satisfy Prisma JSON type
      });

      yield {
        responseType: "Final",
        content: savedMessage.content,
        message: TranslateMessage(savedMessage),
      };
    } else {
      // Fallback response if no content was generated
      const fallbackMessage = await saveMessage({
        threadId,
        content:
          "I'm having trouble processing your request. Please try again.",
        role: "assistant",
        workspace: workspaceEntries,
        runId: routerResult.runId || threadId,
      });

      yield {
        responseType: "Final",
        content: fallbackMessage.content,
        message: TranslateMessage(fallbackMessage),
      };
    }
  } catch (error) {
    logger.error("Router workflow error:", error);

    // Fallback to a basic error response
    yield {
      responseType: "Final",
      content:
        "I apologize, but I'm experiencing technical difficulties. Please try again.",
      message: null,
    };
  }
}
