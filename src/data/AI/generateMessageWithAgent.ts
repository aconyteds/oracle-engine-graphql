import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import * as Sentry from "@sentry/bun";
import type { GenerateMessagePayload } from "../../generated/graphql";
import { ServerError } from "../../graphql/errors";
import type { MessageWorkspace } from "../MongoDB";
import { saveMessage } from "../MongoDB";
import { getAgentByName } from "./agentList";
import { PrismaCheckpointSaver } from "./Checkpointers";
import { getAgentDefinition } from "./getAgentDefinition";
import { MessageFactory } from "./messageFactory";
import type { HandoffRoutingResponse } from "./schemas";
import type {
  AIAgentDefinition,
  RequestContext,
  YieldMessageFunction,
} from "./types";
import { RouterType } from "./types";

export type GenerateMessageWithAgentProps = {
  threadId: string;
  runId: string;
  agent: AIAgentDefinition;
  messageHistory: BaseMessage[];
  requestContext: RequestContext;
  enqueueMessage: (payload: GenerateMessagePayload) => void;
};

/**
 * Unified message generation using LangChain v1 createAgent API
 * Replaces both generateMessageWithRouter and generateMessageWithStandardWorkflow
 * Now uses message queue for real-time streaming instead of generator pattern
 */
export async function generateMessageWithAgent({
  threadId,
  runId,
  agent,
  messageHistory,
  requestContext,
  enqueueMessage,
}: GenerateMessageWithAgentProps): Promise<void> {
  const { userId, campaignId } = requestContext;

  // Prepare workspace entries for debugging/auditing
  const workspaceEntries: MessageWorkspace[] = [];

  // Create enqueue function for tools to call
  const yieldMessage: YieldMessageFunction = (payload) => {
    // Add to workspace for final message storage
    workspaceEntries.push({
      messageType: payload.responseType,
      content: payload.content || "",
      timestamp: new Date(),
      elapsedTime: null,
    });

    // Enqueue for real-time streaming
    enqueueMessage(payload);
  };

  // Enrich context with yield function
  const enrichedContext: RequestContext = {
    ...requestContext,
    yieldMessage,
  };

  // Get agent instance with tools and checkpointer configured
  const agentInstance = await getAgentDefinition(agent, enrichedContext);

  if (!agentInstance) {
    throw ServerError("Invalid agent configuration detected.");
  }

  // Debug info about available tools
  const toolCount = agent.availableTools?.length || 0;
  const subAgentCount = agent.availableSubAgents?.length || 0;

  const debugPayload = MessageFactory.debug(
    `🔧 Agent: ${agent.name} | Tools: ${toolCount} | Sub-agents: ${subAgentCount}`
  );
  enqueueMessage(debugPayload);

  workspaceEntries.push({
    messageType: debugPayload.responseType,
    content: debugPayload.content || "",
    timestamp: new Date(),
    elapsedTime: null,
  });

  try {
    // Composite thread ID for checkpointer: userId:threadId:campaignId
    const compositeThreadId = `${userId}:${threadId}:${campaignId}`;

    // Determine which messages to pass to the agent to avoid duplication in the checkpointer
    let messagesToPass = messageHistory;

    // Check if a checkpoint already exists for this thread
    const checkpointer = new PrismaCheckpointSaver();
    const checkpointTuple = await checkpointer.getTuple({
      configurable: { thread_id: compositeThreadId },
    });

    if (checkpointTuple) {
      // If checkpoint exists, we assume the history is already saved.
      // We only pass the *new* message (the last one from the user).
      // This prevents re-appending the entire history to the checkpoint.
      if (messageHistory.length > 0) {
        messagesToPass = [messageHistory[messageHistory.length - 1]];
      } else {
        messagesToPass = [];
      }
    }
    // If no checkpoint exists, we pass the full history (messagesToPass = messageHistory)

    // Invoke agent with checkpointer and enriched context
    const result = await agentInstance.invoke(
      { messages: messagesToPass },
      {
        configurable: {
          thread_id: compositeThreadId,
        },
        context: enrichedContext,
      }
    );

    // Check if this is a router that made a handoff decision
    // This must happen BEFORE extracting final messages
    if (agent.routerType === RouterType.Handoff) {
      console.debug(
        "Agent is a Handoff router, checking for routing decision..."
      );
      const targetAgentName = extractRoutingDecision(
        result.structuredResponse as HandoffRoutingResponse | null,
        requestContext
      );

      if (targetAgentName) {
        console.debug(`✓ Handoff detected: ${agent.name} → ${targetAgentName}`);

        // Router made a handoff decision - invoke target agent
        const routingPayload = MessageFactory.routing(targetAgentName);
        enqueueMessage(routingPayload);

        workspaceEntries.push({
          messageType: "routing",
          content: `Handed off to ${targetAgentName}`,
          timestamp: new Date(),
          elapsedTime: null,
        });

        // Get the target agent
        const targetAgent = getAgentByName(targetAgentName);
        if (!targetAgent) {
          throw ServerError(`Target agent ${targetAgentName} not found`);
        }

        // Recursively call with the target agent
        // Pass empty message history as state is already in checkpoint
        // Pass enqueue function down to maintain real-time streaming
        await generateMessageWithAgent({
          threadId,
          runId,
          agent: targetAgent,
          messageHistory: [],
          requestContext: enrichedContext,
          enqueueMessage,
        });
        return; // Exit after handoff - don't process router's response
      }
      Sentry.captureMessage(
        "No target agent found in handoff routing decision",
        {
          extra: {
            reminder:
              "The router indicated a handoff but did not specify a valid target agent. Check Agent sub-agents and configuration to ensure proper setup.",
            agentName: agent.name,
            context: requestContext,
          },
        }
      );
    }

    // Extract the final assistant message
    const assistantMessages = result.messages.filter(
      (msg) => msg.type === "ai"
    ) as AIMessage[];

    if (assistantMessages.length === 0) {
      throw ServerError("No assistant response generated");
    }

    // Get the last assistant message
    const finalMessage = assistantMessages[assistantMessages.length - 1];
    const finalResponse = finalMessage.content as string;

    // Check for tool calls in the message history
    const toolCallMessages = result.messages.filter(
      (msg) => msg.type === "ai" && (msg as AIMessage).tool_calls?.length
    ) as AIMessage[];

    if (toolCallMessages.length > 0) {
      // Yield intermediate status about tool usage
      const toolNames = toolCallMessages
        .flatMap((msg) => msg.tool_calls?.map((tc) => tc.name) || [])
        .filter((name): name is string => !!name);

      if (toolNames.length > 0) {
        const toolUsagePayload = MessageFactory.toolUsage(toolNames);
        enqueueMessage(toolUsagePayload);

        workspaceEntries.push({
          messageType: "tool_usage",
          content: `Tools used: ${toolNames.join(", ")}`,
          timestamp: new Date(),
          elapsedTime: null,
        });
      }
    }

    // Save the final message to DB
    const savedMessage = await saveMessage({
      threadId,
      content: finalResponse,
      role: "assistant",
      workspace: workspaceEntries,
      runId,
    });

    // Enqueue final payload to client
    enqueueMessage(MessageFactory.final(savedMessage));
  } catch (error) {
    console.error("Error in agent generation:", error);
    Sentry.captureException(error, {
      extra: {
        threadId,
        runId,
        agentName: agent.name,
        requestContext,
        messageHistoryLength: messageHistory.length,
        reminder:
          "This error occurred during agent message generation. This is likely unrelated to handoff, but instead related to the agent's internal processing. Investigate the agent configuration, tools, and invocation parameters to identify the root cause.",
      },
    });
    throw ServerError("Error generating message with agent.");
  }
}

/**
 * Helper to extract routing decision from structured response
 */
function extractRoutingDecision(
  structuredResponse: HandoffRoutingResponse | null,
  context: RequestContext
): string | null {
  if (!structuredResponse) {
    Sentry.captureMessage("No structured response for routing decision", {
      extra: {
        ...context,
        reminder:
          "This indicates that the agent did not return structured data as expected. Need to review agent configuration and response handling.",
      },
    });
    return null;
  }

  console.debug(
    "Extracting routing decision from structured response:",
    structuredResponse
  );

  if (structuredResponse.targetAgent) {
    console.debug(
      "Routing Decision:",
      structuredResponse.targetAgent,
      `(${structuredResponse.confidence} confidence)`
    );
    console.debug("Reasoning:", structuredResponse.reasoning);
    console.debug(
      "Intent Keywords:",
      structuredResponse.intentKeywords?.join(", ")
    );
    return structuredResponse.targetAgent;
  }

  console.debug("No routing decision found in structured response");
  return null;
}
