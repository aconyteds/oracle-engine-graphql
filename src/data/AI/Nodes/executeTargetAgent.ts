import type { DynamicTool } from "@langchain/core/tools";
import { getModelDefinition } from "../getModelDefinition";
import { runToolEnabledWorkflow } from "../Workflows/toolEnabledWorkflow";
import type { RouterGraphState } from "../Workflows/routerWorkflow";

export async function executeTargetAgent(state: typeof RouterGraphState.State) {
  const { routingDecision } = state;
  if (!routingDecision) {
    throw new Error("No routing decision available");
  }

  try {
    const targetAgent = routingDecision.targetAgent;
    if (!targetAgent) {
      throw new Error(`Agent ${routingDecision.targetAgent} not found`);
    }

    const model = getModelDefinition(targetAgent);
    if (!model) {
      throw new Error(
        `Model for agent ${routingDecision.targetAgent} not configured`
      );
    }

    // Execute the actual agent workflow using prepared messages (with proper system message)
    const messagesToUse =
      state.preparedMessages || state.originalMessages || state.messages;

    const result = await runToolEnabledWorkflow({
      messages: messagesToUse,
      threadId: state.runId,
      agent: targetAgent,
      tools: targetAgent.availableTools as DynamicTool[],
    });

    const workflowResult = result as typeof RouterGraphState.State;
    return {
      ...state,
      ...workflowResult,
      targetAgent,
      isRouted: true,
      routingMetadata: {
        ...state.routingMetadata!,
        success: true,
      },
    };
  } catch (error) {
    console.error(
      `Failed to execute target agent ${routingDecision.targetAgent.name}:`,
      error
    );

    return {
      ...state,
      currentResponse: `I apologize, but I encountered an issue while processing your request with the ${routingDecision.targetAgent.name} agent. Let me try a different approach.`,
      routingMetadata: {
        ...state.routingMetadata!,
        success: false,
      },
    };
  }
}
