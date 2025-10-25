import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

/**
 * Node that generates final response after tool execution
 */
export async function generateFinalResponse(
  state: typeof ToolEnabledGraphState.State
): Promise<Partial<typeof ToolEnabledGraphState.State>> {
  const { messages, model, runId, metadata } = state;

  if (messages.length === 0) {
    throw new Error("No messages available for final response generation");
  }

  try {
    const response = await model.invoke(messages, {
      runId,
    });

    return {
      messages: [response],
      currentResponse: response.content as string,
      isComplete: true,
      metadata: {
        ...metadata,
        finalResponseGenerated: true,
      },
    };
  } catch (error) {
    console.error("Error generating final response:", error);
    throw error;
  }
}
