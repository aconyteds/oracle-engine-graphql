import type { BaseMessage } from "@langchain/core/messages";
import type { DynamicTool } from "@langchain/core/tools";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { cheapest } from "../Agents";
import { getModelDefinition } from "../getModelDefinition";
import {
  executeTools,
  generateFinalResponse,
  generateWithTools,
  validateToolInput,
} from "../Nodes";
import type {
  AIAgentDefinition,
  ToolCall,
  ToolCallForDB,
  ToolResultForDB,
} from "../types";

// Enhanced graph state schema with tools using modern Annotation pattern
export const ToolEnabledGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),
  agent: Annotation<AIAgentDefinition>({
    reducer: (x: AIAgentDefinition, y?: AIAgentDefinition) => y ?? x,
    default: () => cheapest,
  }),
  model: Annotation<ChatOpenAI>({
    reducer: (x: ChatOpenAI, y?: ChatOpenAI) => y ?? x,
  }),
  tools: Annotation<DynamicTool[]>({
    reducer: (x: DynamicTool[], y?: DynamicTool[]) => y ?? x,
    default: () => [],
  }),
  runId: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => "",
  }),
  currentResponse: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => "",
  }),
  toolCalls: Annotation<ToolCall[] | undefined>({
    reducer: (x?: ToolCall[], y?: ToolCall[]) => y ?? x,
    default: () => [],
  }),
  toolResults: Annotation<Record<string, unknown> | undefined>({
    reducer: (x?: Record<string, unknown>, y?: Record<string, unknown>) => ({
      ...x,
      ...y,
    }),
    default: () => ({}),
  }),
  isComplete: Annotation<boolean>({
    reducer: (x: boolean, y?: boolean) => y ?? x,
    default: () => false,
  }),
  metadata: Annotation<Record<string, unknown> | undefined>({
    reducer: (x?: Record<string, unknown>, y?: Record<string, unknown>) => ({
      ...x,
      ...y,
    }),
    default: () => ({}),
  }),
  toolCallsForDB: Annotation<ToolCallForDB[] | undefined>({
    reducer: (x?: ToolCallForDB[], y?: ToolCallForDB[]) => y ?? x,
    default: () => [],
  }),
  toolResultsForDB: Annotation<ToolResultForDB[] | undefined>({
    reducer: (x?: ToolResultForDB[], y?: ToolResultForDB[]) => y ?? x,
    default: () => [],
  }),
});

/**
 * Conditional edge function to determine next step after initial generation
 */
function shouldExecuteTools(state: typeof ToolEnabledGraphState.State): string {
  if (state.toolCalls && state.toolCalls.length > 0) {
    return "execute_tools";
  }
  return END;
}

/**
 * Creates and compiles the tool-enabled message generation workflow
 */
export function createToolEnabledWorkflow() {
  const workflow = new StateGraph(ToolEnabledGraphState)
    .addNode("validate_input", validateToolInput)
    .addNode("generate_with_tools", generateWithTools)
    .addNode("execute_tools", executeTools)
    .addNode("generate_final", generateFinalResponse)
    .addEdge(START, "validate_input")
    .addEdge("validate_input", "generate_with_tools")
    .addConditionalEdges("generate_with_tools", shouldExecuteTools)
    .addEdge("execute_tools", "generate_final")
    .addEdge("generate_final", END);

  return workflow.compile();
}

type RunToolEnabledWorkflowInput = {
  messages: BaseMessage[];
  threadId?: string;
  agent: AIAgentDefinition;
  tools: DynamicTool[];
};

/**
 * Tool-enabled workflow runner
 */
export async function runToolEnabledWorkflow({
  messages,
  threadId: runId,
  agent,
  tools,
}: RunToolEnabledWorkflowInput): Promise<unknown> {
  const workflow = createToolEnabledWorkflow();
  const model = getModelDefinition(agent);
  if (!model) {
    throw new Error(`Model for agent ${agent.name} not configured`);
  }

  const initialState = {
    messages,
    agent,
    model,
    tools,
    runId,
    isComplete: false,
  };

  const result = await workflow.invoke(initialState);
  return result;
}
