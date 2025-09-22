import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { ToolEnabledGraphState } from "./toolEnabledWorkflow";
import type {
  RoutingDecision,
  RoutingMetadata,
  AIAgentDefinition,
} from "../types";
// Import the nodes that will be implemented
import { analyzeAndRoute } from "../Nodes/analyzeAndRoute";
import { executeTargetAgent } from "../Nodes/executeTargetAgent";
import { validateRouting } from "../Nodes/validateRouting";
import { executeFallback } from "../Nodes/executeFallback";
import { executeDefaultAgent } from "../Nodes/executeDefaultAgent";

// Enhanced workflow state that includes routing capabilities
export const RouterGraphState = Annotation.Root({
  ...ToolEnabledGraphState.spec, // Inherit all existing state

  // Router-specific state
  routingDecision: Annotation<RoutingDecision | undefined>({
    reducer: (x?: RoutingDecision, y?: RoutingDecision) => y ?? x,
    default: () => undefined,
  }),
  targetAgent: Annotation<AIAgentDefinition | undefined>({
    reducer: (x?: AIAgentDefinition, y?: AIAgentDefinition) => y ?? x,
    default: () => undefined,
  }),
  routingAttempts: Annotation<number>({
    reducer: (x: number, y: number) => Math.max(x, y),
    default: () => 0,
  }),
  isRouted: Annotation<boolean>({
    reducer: (x: boolean, y?: boolean) => y ?? x,
    default: () => false,
  }),
  routingMetadata: Annotation<RoutingMetadata | undefined>({
    reducer: (x?: RoutingMetadata, y?: RoutingMetadata) => y ?? x,
    default: () => undefined,
  }),
  routerAgent: Annotation<AIAgentDefinition | undefined>({
    reducer: (x?: AIAgentDefinition, y?: AIAgentDefinition) => y ?? x,
    default: () => undefined,
  }),
  originalMessages: Annotation<BaseMessage[] | undefined>({
    reducer: (x?: BaseMessage[], y?: BaseMessage[]) => y ?? x,
    default: () => undefined,
  }),
  preparedMessages: Annotation<BaseMessage[] | undefined>({
    reducer: (x?: BaseMessage[], y?: BaseMessage[]) => y ?? x,
    default: () => undefined,
  }),
});

/**
 * Conditional edge function to determine routing flow
 */
function shouldExecuteTargetAgent(
  state: typeof RouterGraphState.State
): string {
  if (state.routingDecision && state.routingAttempts < 3) {
    return "execute_target";
  }
  if (state.routingAttempts >= 3) {
    return "fallback_execution";
  }
  return "analyze_request";
}

/**
 * Conditional edge function for validation
 */
function shouldUseFallback(state: typeof RouterGraphState.State): string {
  if (state.routingMetadata?.success) {
    return END;
  }
  if (state.routingAttempts < 3) {
    return "fallback_routing";
  }
  return END;
}

/**
 * Creates and compiles the router-enabled workflow
 */
export function createRouterWorkflow() {
  const workflow = new StateGraph(RouterGraphState)
    .addNode("analyze_request", analyzeAndRoute)
    .addNode("execute_target", executeTargetAgent)
    .addNode("validate_routing", validateRouting)
    .addNode("fallback_routing", executeFallback)
    .addNode("fallback_execution", executeDefaultAgent)
    .addEdge(START, "analyze_request")
    .addConditionalEdges("analyze_request", shouldExecuteTargetAgent)
    .addEdge("execute_target", "validate_routing")
    .addConditionalEdges("validate_routing", shouldUseFallback)
    .addEdge("fallback_routing", "validate_routing")
    .addEdge("fallback_execution", END);

  return workflow.compile();
}

export async function runRouterWorkflow(input: {
  messages: BaseMessage[];
  threadId: string;
  agent: AIAgentDefinition;
}): Promise<typeof RouterGraphState.State> {
  const workflow = createRouterWorkflow();

  const initialState = {
    messages: input.messages,
    runId: input.threadId,
    routingAttempts: 0,
    isRouted: false,
    routerAgent: input.agent, // Pass the router agent to the workflow state
    originalMessages: input.messages, // Store original messages for target agents
  };

  const result = await workflow.invoke(initialState);
  return result;
}
