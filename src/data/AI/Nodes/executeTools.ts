import { ToolMessage } from "@langchain/core/messages";

import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";
import type { ToolResultForDB } from "../types";

/**
 * Node that executes tool calls
 */
export async function executeTools(
  state: typeof ToolEnabledGraphState.State
): Promise<Partial<typeof ToolEnabledGraphState.State>> {
  const { toolCalls, tools, metadata } = state;

  if (!toolCalls || toolCalls.length === 0) {
    return { isComplete: true };
  }

  const toolMessages: ToolMessage[] = [];
  const results: Record<string, unknown> = {};
  const toolResultsForDB: ToolResultForDB[] = [];

  for (const toolCall of toolCalls) {
    const tool = tools.find((t) => t.name === toolCall.name);

    if (!tool) {
      const errorMessage = `Tool ${toolCall.name} not found`;
      toolMessages.push(
        new ToolMessage(errorMessage, toolCall.id || "unknown")
      );
      results[toolCall.name] = { error: errorMessage };
      toolResultsForDB.push({
        toolName: toolCall.name,
        result: errorMessage,
        toolCallId: toolCall.id,
        dateOccurred: new Date(),
      });
      continue;
    }

    try {
      const startTime = Date.now();
      const toolResult = (await tool.invoke(toolCall.args)) as unknown;
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000; // Convert to seconds

      const resultString =
        typeof toolResult === "string"
          ? toolResult
          : JSON.stringify(toolResult);

      toolMessages.push(
        new ToolMessage(resultString, toolCall.id || "unknown")
      );
      results[toolCall.name] = toolResult;
      toolResultsForDB.push({
        toolName: toolCall.name,
        result: resultString,
        toolCallId: toolCall.id,
        elapsedTime,
        dateOccurred: new Date(),
      });
    } catch (error) {
      const errorMessage = `Error executing tool ${toolCall.name}: ${String(
        error
      )}`;
      toolMessages.push(
        new ToolMessage(errorMessage, toolCall.id || "unknown")
      );
      results[toolCall.name] = { error: errorMessage };
      toolResultsForDB.push({
        toolName: toolCall.name,
        result: errorMessage,
        toolCallId: toolCall.id,
        dateOccurred: new Date(),
      });
    }
  }

  return {
    messages: toolMessages,
    toolResults: results,
    toolResultsForDB,
    metadata: {
      ...metadata,
      toolsExecuted: true,
      toolExecutionResults: Object.keys(results),
    },
  };
}
