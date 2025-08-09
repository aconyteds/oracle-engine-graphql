import type { DynamicTool } from "@langchain/core/tools";

import { ServerError } from "../../../graphql/errors";
import {
  truncateMessageHistory,
  getAgentByName,
  getModelDefinition,
  runToolEnabledWorkflow,
} from "../../../data/AI";
import type { MessageItem, RoleTypes } from "../../../data/AI";
import type { ToolCallForDB, ToolResultForDB } from "../../../data/AI/types";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import { TranslateMessage } from "../../utils";
import type { MessageWorkspace } from "../../../data/MongoDB";
import { DBClient, saveMessage } from "../../../data/MongoDB";

// Type definition for the workflow result
interface WorkflowResult {
  metadata?: {
    hasToolCalls?: boolean;
    toolExecutionResults?: string[];
  };
  currentResponse?: string;
  toolCallsForDB?: ToolCallForDB[];
  toolResultsForDB?: ToolResultForDB[];
}

export async function* generateMessage(
  threadId: string
): AsyncGenerator<GenerateMessagePayload> {
  // Get the Thread
  const thread = await DBClient.thread.findUnique({
    where: {
      id: threadId,
    },
    select: {
      userId: true,
      selectedAgent: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!thread) {
    throw ServerError("Thread not found");
  }

  const currAgent = getAgentByName(thread.selectedAgent);
  if (!currAgent) {
    throw ServerError("Invalid agent selected.");
  }

  const { model, useHistory, systemMessage, availableTools = [] } = currAgent;
  const AIModel = getModelDefinition(currAgent);
  if (!AIModel) {
    throw ServerError("Invalid agent Configuration detected.");
  }

  const messageHistory: MessageItem[] = [];
  messageHistory.push({
    role: "system",
    content: systemMessage,
  });

  if (useHistory) {
    thread.messages.forEach((message) => {
      messageHistory.push({
        role: message.role as RoleTypes,
        content: message.content,
        tokenCount: message.tokenCount,
      });
    });
  } else {
    // Get the last user message
    const lastUserMessage = thread.messages
      .slice()
      .reverse()
      .find((message) => message.role === "user");

    messageHistory.push({
      role: "user",
      content: lastUserMessage?.content || "",
      tokenCount: lastUserMessage?.tokenCount,
    });
  }

  const truncatedMessageHistory = truncateMessageHistory({
    messageList: messageHistory,
    model,
  });

  // Prepare workspace entries for tool calls and results
  const workspaceEntries: MessageWorkspace[] = [];

  const toolsAvailableString = `🔧 Tools available: ${availableTools.map((t) => t.name).join(", ")}`;

  // Yield initial status
  yield {
    responseType: "Debug",
    content: toolsAvailableString,
  };

  workspaceEntries.push({
    messageType: "Debug",
    content: toolsAvailableString,
    timestamp: new Date(),
    elapsedTime: null,
  });

  try {
    // Use tool-enabled workflow
    const result = (await runToolEnabledWorkflow({
      messages: truncatedMessageHistory,
      threadId,
      model: AIModel,
      tools: availableTools as DynamicTool[],
    })) as WorkflowResult;

    // Check if tools were used and provide feedback
    const metadata = result.metadata || {};
    if (metadata.hasToolCalls && metadata.toolExecutionResults) {
      yield {
        responseType: "Intermediate",
        content: `🛠️ Used tools: ${metadata.toolExecutionResults.join(", ")}`,
      };
    }

    const finalResponse = result.currentResponse || "";

    // Add tool calls to workspace
    if (result.toolCallsForDB && result.toolCallsForDB.length > 0) {
      for (const toolCall of result.toolCallsForDB) {
        workspaceEntries.push({
          messageType: "tool_call",
          content: `\ntool_name: **${toolCall.toolName}**\n\narguments: \n${JSON.stringify(JSON.parse(toolCall.arguments), null, 2)}`,
          timestamp: toolCall.dateOccurred,
          elapsedTime: null,
        });
      }
    }

    // Add tool results to workspace
    if (result.toolResultsForDB && result.toolResultsForDB.length > 0) {
      for (const toolResult of result.toolResultsForDB) {
        workspaceEntries.push({
          messageType: "tool_result",
          content: toolResult.result,
          elapsedTime: toolResult.elapsedTime ?? null,
          timestamp: toolResult.dateOccurred,
        });
      }
    }

    // TODO: Add reasoning/chain of thought entries when available
    // Example of how to add reasoning entries:
    // workspaceEntries.push({
    //   messageType: "reasoning",
    //   content: reasoningData.content,
    //   elapsedTime: reasoningData.thinkingTime,
    // });

    // Save the final message to the DB with workspace entries
    const savedMessage = await saveMessage({
      threadId,
      content: finalResponse,
      role: "assistant",
      workspace: workspaceEntries,
    });

    // Yield a final payload to the client
    const finalPayload: GenerateMessagePayload = {
      responseType: "Final",
      content: savedMessage.content,
      message: TranslateMessage(savedMessage),
    };
    yield finalPayload;
  } catch (error) {
    console.error("Error in tool-enabled generation:", error);
    throw ServerError("Error generating message with tools.");
  }
}
