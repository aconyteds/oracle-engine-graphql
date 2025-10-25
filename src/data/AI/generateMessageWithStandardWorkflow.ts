import type { BaseMessage } from "@langchain/core/messages";
import type { DynamicTool } from "@langchain/core/tools";
import type { GenerateMessagePayload } from "../../generated/graphql";
import { ServerError } from "../../graphql/errors";
import { TranslateMessage } from "../../modules/utils";
import type { MessageWorkspace } from "../MongoDB";
import { saveMessage } from "../MongoDB";
import { getModelDefinition, runToolEnabledWorkflow } from ".";
import type {
  AIAgentDefinition,
  ToolCallForDB,
  ToolResultForDB,
} from "./types";

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

export type GenerateMessageWithStandardWorkflowProps = {
  threadId: string;
  agent: AIAgentDefinition;
  messageHistory: BaseMessage[];
  runId: string;
};

export async function* generateMessageWithStandardWorkflow({
  threadId,
  agent,
  messageHistory,
  runId,
}: GenerateMessageWithStandardWorkflowProps): AsyncGenerator<GenerateMessagePayload> {
  const { availableTools = [] } = agent;
  const AIModel = getModelDefinition(agent);

  if (!AIModel) {
    throw ServerError("Invalid agent Configuration detected.");
  }

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
      messages: messageHistory,
      threadId: runId,
      agent,
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

    // Save the final message to the DB with workspace entries
    const savedMessage = await saveMessage({
      threadId,
      content: finalResponse,
      role: "assistant",
      workspace: workspaceEntries,
      runId,
    });

    // Yield a final payload to the client
    const finalPayload: GenerateMessagePayload = {
      responseType: "Final",
      content: savedMessage.content,
      message: TranslateMessage(savedMessage),
    };
    yield finalPayload;
  } catch (error) {
    console.error("Error in standard workflow generation:", error);
    throw ServerError("Error generating message with tools.");
  }
}
