import type { DynamicTool } from "@langchain/core/tools";
import { getModelDefinition } from "../getModelDefinition";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import { runToolEnabledWorkflow } from "../Workflows/toolEnabledWorkflow";

export async function executeTargetAgent(state: typeof RouterGraphState.State) {
  const { routingDecision } = state;
  if (!routingDecision) {
    throw new Error("No routing decision available");
  }

  try {
    const targetAgent = routingDecision.targetAgent;
    if (!targetAgent) {
      throw new Error("Routing decision did not include a target agent");
    }
    const targetAgentName = targetAgent.name;

    const model = getModelDefinition(targetAgent);
    if (!model) {
      throw new Error(`Model for agent ${targetAgentName} not configured`);
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
    const agentName = routingDecision.targetAgent?.name ?? "unknown";
    console.error(`Failed to execute target agent ${agentName}:`, error);

    return {
      ...state,
      currentResponse: `I apologize, but I encountered an issue while processing your request with the ${agentName} agent. Let me try a different approach.`,
      routingMetadata: {
        ...state.routingMetadata!,
        success: false,
      },
    };
  }
}
