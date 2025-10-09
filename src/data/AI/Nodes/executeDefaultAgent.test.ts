import { test, expect, beforeEach, mock, describe, afterEach } from "bun:test";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import type { AIAgentDefinition } from "../types";

describe("executeDefaultAgent", () => {
  let mockRunToolEnabledWorkflow: ReturnType<typeof mock>;
  let mockCheapestAgent: AIAgentDefinition;
  let executeDefaultAgent: (
    state: typeof RouterGraphState.State
  ) => Promise<Partial<typeof RouterGraphState.State>>;

  const defaultState = {
    messages: [{ content: "Test message" }],
    runId: "test-run-123",
    routingMetadata: {
      decision: null,
      executionTime: 0,
      success: false,
      fallbackUsed: false,
    },
  } as unknown as typeof RouterGraphState.State;

  const defaultWorkflowResult = {
    currentResponse: "Default agent response",
    isComplete: true,
    metadata: { responseGenerated: true },
  };

  beforeEach(async () => {
    mock.restore();

    mockRunToolEnabledWorkflow = mock();
    mockCheapestAgent = {
      name: "cheapest",
      description: "Cheapest AI agent",
      availableTools: [{ name: "basic-tool" }],
    } as AIAgentDefinition;

    mock.module("../Workflows/toolEnabledWorkflow", () => ({
      runToolEnabledWorkflow: mockRunToolEnabledWorkflow,
    }));

    mock.module("../Agents", () => ({
      cheapest: mockCheapestAgent,
    }));

    const module = await import("./executeDefaultAgent");
    executeDefaultAgent = module.executeDefaultAgent;

    mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> executeDefaultAgent executes cheapest agent successfully", async () => {
    const result = await executeDefaultAgent(defaultState);

    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith({
      messages: defaultState.messages,
      threadId: "test-run-123",
      agent: mockCheapestAgent,
      tools: mockCheapestAgent.availableTools,
    });
    expect(result.targetAgent).toBe(mockCheapestAgent);
    expect(result.isRouted).toBe(true);
    expect(result.routingMetadata?.success).toBe(true);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
  });

  test("Unit -> executeDefaultAgent merges workflow result with state", async () => {
    const result = await executeDefaultAgent(defaultState);

    expect(result.currentResponse).toBe("Default agent response");
    expect(result.isComplete).toBe(true);
    expect(result.metadata?.responseGenerated).toBe(true);
  });

  test("Unit -> executeDefaultAgent preserves original state properties", async () => {
    const extendedState = {
      ...defaultState,
      customField: "value",
      originalMessages: [{ content: "original" }],
    };

    const result = await executeDefaultAgent(extendedState);

    expect(result).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        customField: "value",
        originalMessages: [{ content: "original" }],
        runId: "test-run-123",
      })
    );
  });

  test("Unit -> executeDefaultAgent handles workflow error gracefully", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Workflow execution failed");
    mockRunToolEnabledWorkflow.mockRejectedValue(testError);

    try {
      const result = await executeDefaultAgent(defaultState);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to execute default agent:",
        testError
      );
      expect(result.currentResponse).toBe(
        "I apologize, but I'm experiencing technical difficulties. Please try again."
      );
      expect(result.isComplete).toBe(true);
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(true);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> executeDefaultAgent preserves existing routing metadata", async () => {
    const stateWithMetadata = {
      ...defaultState,
      routingMetadata: {
        decision: { targetAgent: "previous-agent" },
        executionTime: 150,
        success: false,
        fallbackUsed: false,
        customField: "preserved",
      },
    };

    const result = await executeDefaultAgent(stateWithMetadata);

    expect(result.routingMetadata?.decision).toEqual({
      targetAgent: "previous-agent",
    });
    expect(result.routingMetadata?.executionTime).toBe(150);
    expect(result.routingMetadata?.customField).toBe("preserved");
    expect(result.routingMetadata?.success).toBe(true);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
  });

  test("Unit -> executeDefaultAgent handles undefined routing metadata", async () => {
    const stateWithoutMetadata = {
      ...defaultState,
      routingMetadata: undefined,
    };

    const result = await executeDefaultAgent(stateWithoutMetadata);

    expect(result.routingMetadata?.success).toBe(true);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
  });

  test("Unit -> executeDefaultAgent preserves workflow error in error case", async () => {
    const originalConsoleError = console.error;
    console.error = mock();

    mockRunToolEnabledWorkflow.mockRejectedValue(new Error("Network timeout"));

    try {
      const result = await executeDefaultAgent(defaultState);

      expect(result.isComplete).toBe(true);
      expect(result.targetAgent).toBeUndefined();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> executeDefaultAgent uses correct thread ID", async () => {
    const customRunId = "custom-thread-456";
    const state = { ...defaultState, runId: customRunId };

    await executeDefaultAgent(state);

    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: customRunId,
      })
    );
  });
});
