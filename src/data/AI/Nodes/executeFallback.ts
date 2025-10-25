import type { DynamicTool } from "@langchain/core/tools";
import { cheapest } from "../Agents";
import { getModelDefinition } from "../getModelDefinition";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import { runToolEnabledWorkflow } from "../Workflows/toolEnabledWorkflow";

export async function executeFallback(state: typeof RouterGraphState.State) {
  try {
    // Use the fallback agent from the original routing decision, or default to Cheapest
    const fallbackAgent = state.routingDecision?.fallbackAgent || cheapest;

    const model = getModelDefinition(fallbackAgent);
    if (!model) {
      throw new Error(
        `Model for fallback agent ${fallbackAgent.name} not configured`
      );
    }

    const result = await runToolEnabledWorkflow({
      messages: state.messages,
      threadId: state.runId,
      agent: fallbackAgent,
      tools: fallbackAgent.availableTools as DynamicTool[],
    });

    const workflowResult = result as typeof RouterGraphState.State;
    return {
      ...state,
      ...workflowResult,
      targetAgent: fallbackAgent,
      isRouted: true,
      routingAttempts: state.routingAttempts + 1,
      routingMetadata: {
        ...state.routingMetadata!,
        success: true,
        fallbackUsed: true,
      },
    };
  } catch (error) {
    console.error(`Failed to execute fallback agent:`, error);

    return {
      ...state,
      currentResponse: `I apologize, but I'm experiencing technical difficulties. Please try again.`,
      routingAttempts: state.routingAttempts + 1,
      routingMetadata: {
        ...state.routingMetadata!,
        success: false,
        fallbackUsed: true,
      },
    };
  }
}
