import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

/**
 * Validation node for tool-enabled workflow
 */
export async function validateToolInput(
  state: typeof ToolEnabledGraphState.State
): Promise<Partial<typeof ToolEnabledGraphState.State>> {
  const { messages, tools } = state;

  if (!messages || messages.length === 0) {
    throw new Error("No messages provided for generation");
  }

  return {
    metadata: {
      ...state.metadata,
      validated: true,
      messageCount: messages.length,
      toolsAvailable: tools.length,
      toolNames: tools.map((tool) => tool.name),
    },
  };
}
