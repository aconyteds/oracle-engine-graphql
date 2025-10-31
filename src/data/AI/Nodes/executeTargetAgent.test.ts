import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { HumanMessage } from "@langchain/core/messages";
import type { AIAgentDefinition } from "../types";
import type { RouterGraphState } from "../Workflows/routerWorkflow";

let mockGetModelDefinition: ReturnType<typeof mock>;
let mockRunToolEnabledWorkflow: ReturnType<typeof mock>;
let mockConsoleError: ReturnType<typeof mock>;
let originalConsoleError: typeof console.error;
let executeTargetAgent: (
  state: typeof RouterGraphState.State
) => Promise<Partial<typeof RouterGraphState.State>>;

const mockTargetAgent = {
  name: "target-agent",
  description: "Target agent for execution",
  availableTools: [{ name: "target-tool" }],
} as AIAgentDefinition;

const mockModel = {
  invoke: mock(),
};

describe("executeTargetAgent", () => {
  const defaultState = {
    messages: [new HumanMessage("Test message")],
    runId: "test-run-123",
    routingDecision: {
      targetAgent: mockTargetAgent,
      confidence: 4.25,
      reasoning: "Test routing",
      fallbackAgent: mockTargetAgent,
      intentKeywords: ["test"],
      contextFactors: [],
      routedAt: new Date(),
      routingVersion: "1.0",
    },
    routingMetadata: {
      decision: {
        targetAgent: mockTargetAgent,
        confidence: 4.25,
        reasoning: "Test routing",
        fallbackAgent: mockTargetAgent,
        intentKeywords: ["test"],
        contextFactors: [],
        routedAt: new Date(),
        routingVersion: "1.0",
      },
      executionTime: 100,
      success: false,
      fallbackUsed: false,
    },
    // Required RouterGraphState properties
    targetAgent: mockTargetAgent,
    routingAttempts: 0,
    isRouted: false,
    routerAgent: undefined,
    originalMessages: undefined,
    preparedMessages: undefined,
    // Required ToolEnabledGraphState properties
    agent: mockTargetAgent,
    model: mockModel,
    tools: [],
    currentResponse: "",
    toolCalls: undefined,
    toolResults: undefined,
    isComplete: false,
    metadata: undefined,
    toolCallsForDB: undefined,
    toolResultsForDB: undefined,
  } as unknown as typeof RouterGraphState.State;

  const defaultWorkflowResult = {
    currentResponse: "Target agent response",
    isComplete: true,
    metadata: { responseGenerated: true },
  };

  beforeEach(async () => {
    mock.restore();

    mockGetModelDefinition = mock();
    mockRunToolEnabledWorkflow = mock();
    mockConsoleError = mock();
    originalConsoleError = console.error;
    console.error = mockConsoleError;

    void mock.module("../getModelDefinition", () => ({
      getModelDefinition: mockGetModelDefinition,
    }));

    void mock.module("../Workflows/toolEnabledWorkflow", () => ({
      runToolEnabledWorkflow: mockRunToolEnabledWorkflow,
    }));

    const module = await import("./executeTargetAgent");
    executeTargetAgent = module.executeTargetAgent;

    mockGetModelDefinition.mockReturnValue(mockModel);
    mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
  });

  afterEach(() => {
    console.error = originalConsoleError;
    mock.restore();
  });

  test("Unit -> executeTargetAgent executes target agent successfully", async () => {
    const result = await executeTargetAgent(defaultState);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockTargetAgent);
    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith({
      messages: defaultState.messages,
      threadId: "test-run-123",
      agent: mockTargetAgent,
      tools: mockTargetAgent.availableTools,
    });
    expect(result.targetAgent).toBe(mockTargetAgent);
    expect(result.isRouted).toBe(true);
    expect(result.routingMetadata?.success).toBe(true);
  });

  test("Unit -> executeTargetAgent throws error when no routing decision", () => {
    const stateWithoutDecision = {
      ...defaultState,
      routingDecision: undefined,
    };

    expect(executeTargetAgent(stateWithoutDecision)).rejects.toThrow(
      "No routing decision available"
    );
  });

  test("Unit -> executeTargetAgent handles missing target agent gracefully", async () => {
    const stateWithoutTarget = {
      ...defaultState,
      routingDecision: {
        targetAgent: null as unknown as AIAgentDefinition,
        confidence: 0,
        reasoning: "",
        fallbackAgent: mockTargetAgent,
        intentKeywords: [],
        contextFactors: [],
        routedAt: new Date(),
        routingVersion: "1.0",
      },
    };

    const result = await executeTargetAgent(stateWithoutTarget);

    expect(result.currentResponse).toContain(
      "I apologize, but I encountered an issue"
    );
    expect(result.routingMetadata?.success).toBe(false);
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Failed to execute target agent unknown:",
      expect.any(Error)
    );
  });

  test("Unit -> executeTargetAgent uses prepared messages when available", async () => {
    const preparedMessages = [new HumanMessage("Prepared message")];
    const stateWithPrepared = {
      ...defaultState,
      preparedMessages,
    };

    await executeTargetAgent(stateWithPrepared);

    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: preparedMessages,
      })
    );
  });

  test("Unit -> executeTargetAgent uses original messages when no prepared messages", async () => {
    const originalMessages = [new HumanMessage("Original message")];
    const stateWithOriginal = {
      ...defaultState,
      originalMessages,
      preparedMessages: undefined,
    };

    await executeTargetAgent(stateWithOriginal);

    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: originalMessages,
      })
    );
  });

  test("Unit -> executeTargetAgent falls back to messages when no prepared or original", async () => {
    await executeTargetAgent(defaultState);

    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: defaultState.messages,
      })
    );
  });

  test("Unit -> executeTargetAgent handles model configuration error", async () => {
    mockGetModelDefinition.mockReturnValue(null);

    const result = await executeTargetAgent(defaultState);

    expect(mockConsoleError).toHaveBeenCalledWith(
      `Failed to execute target agent ${mockTargetAgent.name}:`,
      expect.any(Error)
    );
    expect(result.currentResponse).toBe(
      `I apologize, but I encountered an issue while processing your request with the ${mockTargetAgent.name} agent. Let me try a different approach.`
    );
    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> executeTargetAgent handles workflow execution error", async () => {
    const testError = new Error("Workflow execution failed");
    mockRunToolEnabledWorkflow.mockRejectedValue(testError);

    const result = await executeTargetAgent(defaultState);

    expect(mockConsoleError).toHaveBeenCalledWith(
      `Failed to execute target agent ${mockTargetAgent.name}:`,
      testError
    );
    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> executeTargetAgent merges workflow result with state", async () => {
    const result = await executeTargetAgent(defaultState);

    expect(result.currentResponse).toBe("Target agent response");
    expect(result.isComplete).toBe(true);
    expect(result.metadata?.responseGenerated).toBe(true);
  });

  test("Unit -> executeTargetAgent preserves existing routing metadata", async () => {
    const stateWithMetadata = {
      ...defaultState,
      routingMetadata: {
        decision: {
          targetAgent: mockTargetAgent,
          confidence: 3.0,
          reasoning: "Previous routing",
          fallbackAgent: mockTargetAgent,
          intentKeywords: ["previous"],
          contextFactors: [],
          routedAt: new Date(),
          routingVersion: "1.0",
        },
        executionTime: 150,
        success: false,
        fallbackUsed: true,
      },
    };

    const result = await executeTargetAgent(stateWithMetadata);

    expect(result.routingMetadata?.decision.targetAgent).toBe(mockTargetAgent);
    expect(result.routingMetadata?.executionTime).toBe(150);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
    // Removed customField test as it's not part of RoutingMetadata interface
    expect(result.routingMetadata?.success).toBe(true);
  });

  test("Unit -> executeTargetAgent preserves other state properties", async () => {
    const extendedState = {
      ...defaultState,
      routingAttempts: 2,
    };

    const result = await executeTargetAgent(extendedState);

    expect(result.routingAttempts).toBe(2);
  });
});
