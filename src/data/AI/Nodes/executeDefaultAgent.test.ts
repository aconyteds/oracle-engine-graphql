import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { HumanMessage } from "@langchain/core/messages";
import type { AIAgentDefinition } from "../types";
import type { RouterGraphState } from "../Workflows/routerWorkflow";

describe("executeDefaultAgent", () => {
  let mockRunToolEnabledWorkflow: ReturnType<typeof mock>;
  let mockConsoleError: ReturnType<typeof mock>;
  let originalConsoleError: typeof console.error;
  let mockCheapestAgent: AIAgentDefinition;
  let executeDefaultAgent: (
    state: typeof RouterGraphState.State
  ) => Promise<Partial<typeof RouterGraphState.State>>;

  const defaultState = {
    messages: [new HumanMessage("Test message")],
    runId: "test-run-123",
    routingMetadata: {
      decision: undefined,
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
    mockConsoleError = mock();
    originalConsoleError = console.error;
    console.error = mockConsoleError;
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
    console.error = originalConsoleError;
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
    const originalMessages = [new HumanMessage("original")];
    const extendedState = {
      ...defaultState,
      originalMessages,
    };

    const result = await executeDefaultAgent(extendedState);

    expect(result).toEqual(
      expect.objectContaining({
        originalMessages,
        runId: "test-run-123",
      })
    );
  });

  test("Unit -> executeDefaultAgent handles workflow error gracefully", async () => {
    const testError = new Error("Workflow execution failed");
    mockRunToolEnabledWorkflow.mockRejectedValue(testError);

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
  });

  test("Unit -> executeDefaultAgent preserves existing routing metadata", async () => {
    const stateWithMetadata = {
      ...defaultState,
      routingMetadata: {
        decision: defaultState.routingMetadata!.decision,
        executionTime: 150,
        success: false,
        fallbackUsed: false,
        userSatisfaction: 0.8,
      },
    };

    const result = await executeDefaultAgent(stateWithMetadata);

    expect(result.routingMetadata?.decision).toEqual(
      defaultState.routingMetadata!.decision
    );
    expect(result.routingMetadata?.executionTime).toBe(150);
    expect(result.routingMetadata?.userSatisfaction).toBe(0.8);
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
    mockRunToolEnabledWorkflow.mockRejectedValue(new Error("Network timeout"));

    const result = await executeDefaultAgent(defaultState);

    expect(result.isComplete).toBe(true);
    expect(result.targetAgent).toBeUndefined();
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
