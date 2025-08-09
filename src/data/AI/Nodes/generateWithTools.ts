import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";
import type { ToolCall, ToolCallForDB } from "../types";

/**
 * Node that generates a response from the AI model with tool calling capability
 */
export async function generateWithTools(
  state: typeof ToolEnabledGraphState.State
): Promise<Partial<typeof ToolEnabledGraphState.State>> {
  const { messages, model, tools, runId, metadata } = state;

  try {
    // Bind tools to the model if tools are available
    const modelWithTools = tools.length > 0 ? model.bindTools(tools) : model;

    const response = await modelWithTools.invoke(messages, {
      runId,
    });

    // Check if the response contains tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Create tool calls for database storage
      const toolCallsForDB: ToolCallForDB[] = response.tool_calls.map(
        (toolCall: ToolCall) => ({
          toolName: toolCall.name,
          arguments: JSON.stringify(toolCall.args),
          toolCallId: toolCall.id,
          dateOccurred: new Date(),
        })
      );

      return {
        messages: [response],
        toolCalls: response.tool_calls,
        toolCallsForDB,
        metadata: {
          ...metadata,
          hasToolCalls: true,
          toolCallCount: response.tool_calls.length,
        },
      };
    }

    // No tool calls, just a regular response
    return {
      messages: [response],
      currentResponse: response.content as string,
      isComplete: true,
      metadata: {
        ...metadata,
        responseGenerated: true,
        hasToolCalls: false,
      },
    };
  } catch (error) {
    console.error("Error generating response with tools:", error);
    throw error;
  }
}
