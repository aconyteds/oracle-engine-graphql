import type { DynamicTool } from "@langchain/core/tools";
import { cheapest } from "../Agents";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import { runToolEnabledWorkflow } from "../Workflows/toolEnabledWorkflow";

export async function executeDefaultAgent(
  state: typeof RouterGraphState.State
) {
  try {
    const defaultAgent = cheapest;

    const result = await runToolEnabledWorkflow({
      messages: state.messages,
      threadId: state.runId,
      agent: defaultAgent,
      tools: defaultAgent.availableTools as DynamicTool[],
    });

    const workflowResult = result as typeof RouterGraphState.State;
    return {
      ...state,
      ...workflowResult,
      targetAgent: defaultAgent,
      isRouted: true,
      routingMetadata: {
        ...state.routingMetadata!,
        success: true,
        fallbackUsed: true,
      },
    };
  } catch (error) {
    console.error("Failed to execute default agent:", error);

    return {
      ...state,
      currentResponse:
        "I apologize, but I'm experiencing technical difficulties. Please try again.",
      isComplete: true,
      routingMetadata: {
        ...state.routingMetadata!,
        success: false,
        fallbackUsed: true,
      },
    };
  }
}
