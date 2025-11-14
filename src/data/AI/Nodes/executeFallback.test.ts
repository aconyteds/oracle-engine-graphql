import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { HumanMessage } from "@langchain/core/messages";
import type { AIAgentDefinition } from "../types";
import type { RouterGraphState } from "../Workflows/routerWorkflow";

describe("executeFallback", () => {
  let mockGetModelDefinition: ReturnType<typeof mock>;
  let mockRunToolEnabledWorkflow: ReturnType<typeof mock>;
  let mockConsoleError: ReturnType<typeof mock>;
  let originalConsoleError: typeof console.error;
  let executeFallback: (
    state: typeof RouterGraphState.State
  ) => Promise<Partial<typeof RouterGraphState.State>>;

  const mockCheapestAgent = {
    name: "cheapest",
    description: "Cheapest AI agent",
    availableTools: [{ name: "basic-tool" }],
  } as AIAgentDefinition;

  const mockFallbackAgent = {
    name: "fallback-agent",
    description: "Fallback agent",
    availableTools: [{ name: "fallback-tool" }],
  } as AIAgentDefinition;

  const mockModel = {
    invoke: mock(),
  };

  const defaultState = {
    messages: [{ content: "Test message" }],
    runId: "test-run-123",
    routingAttempts: 1,
    routingDecision: {
      fallbackAgent: mockFallbackAgent,
    },
    routingMetadata: {
      decision: null,
      executionTime: 100,
      success: false,
      fallbackUsed: false,
    },
  } as unknown as typeof RouterGraphState.State;

  const defaultWorkflowResult = {
    currentResponse: "Fallback agent response",
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

    void mock.module("../Agents", () => ({
      cheapest: mockCheapestAgent,
    }));

    const module = await import("./executeFallback");
    executeFallback = module.executeFallback;

    mockGetModelDefinition.mockReturnValue(mockModel);
    mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
  });

  afterEach(() => {
    console.error = originalConsoleError;
    mock.restore();
  });

  test("Unit -> executeFallback executes fallback agent from routing decision", async () => {
    const result = await executeFallback(defaultState);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockFallbackAgent);
    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith({
      messages: defaultState.messages,
      threadId: "test-run-123",
      agent: mockFallbackAgent,
      tools: mockFallbackAgent.availableTools,
    });
    expect(result.targetAgent).toBe(mockFallbackAgent);
    expect(result.isRouted).toBe(true);
    expect(result.routingAttempts).toBe(2);
    expect(result.routingMetadata?.success).toBe(true);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
  });

  test("Unit -> executeFallback uses cheapest agent when no fallback in routing decision", async () => {
    const stateWithoutFallback = {
      ...defaultState,
      routingDecision: undefined,
    };

    const result = await executeFallback(stateWithoutFallback);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockCheapestAgent);
    expect(result.targetAgent).toBe(mockCheapestAgent);
  });

  test("Unit -> executeFallback uses cheapest agent when routing decision is undefined", async () => {
    const stateWithoutDecision = {
      ...defaultState,
      routingDecision: undefined,
    };

    const result = await executeFallback(stateWithoutDecision);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockCheapestAgent);
    expect(result.targetAgent).toBe(mockCheapestAgent);
  });

  test("Unit -> executeFallback handles model configuration error", async () => {
    mockGetModelDefinition.mockReturnValue(null);

    const result = await executeFallback(defaultState);

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Failed to execute fallback agent:",
      expect.any(Error)
    );
    expect(result.currentResponse).toBe(
      "I apologize, but I'm experiencing technical difficulties. Please try again."
    );
    expect(result.routingAttempts).toBe(2);
    expect(result.routingMetadata?.success).toBe(false);
    expect(result.routingMetadata?.fallbackUsed).toBe(true);
  });

  test("Unit -> executeFallback handles workflow execution error", async () => {
    const testError = new Error("Workflow execution failed");
    mockRunToolEnabledWorkflow.mockRejectedValue(testError);

    const result = await executeFallback(defaultState);

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Failed to execute fallback agent:",
      testError
    );
    expect(result.currentResponse).toBe(
      "I apologize, but I'm experiencing technical difficulties. Please try again."
    );
    expect(result.routingMetadata?.success).toBe(false);
  });

  test("Unit -> executeFallback merges workflow result with state", async () => {
    const result = await executeFallback(defaultState);

    expect(result.currentResponse).toBe("Fallback agent response");
    expect(result.isComplete).toBe(true);
    expect(result.metadata?.responseGenerated).toBe(true);
  });

  test("Unit -> executeFallback preserves existing routing metadata", async () => {
    const stateWithMetadata = {
      ...defaultState,
      routingMetadata: {
        decision: defaultState.routingMetadata!.decision,
        executionTime: 200,
        success: false,
        fallbackUsed: false,
        userSatisfaction: 0.7,
      },
    };

    const result = await executeFallback(stateWithMetadata);

    expect(result.routingMetadata).toEqual(
      expect.objectContaining({
        decision: defaultState.routingMetadata!.decision,
        executionTime: 200,
        userSatisfaction: 0.7,
        success: true,
        fallbackUsed: true,
      })
    );
  });

  test("Unit -> executeFallback increments routing attempts", async () => {
    const stateWithAttempts = {
      ...defaultState,
      routingAttempts: 5,
    };

    const result = await executeFallback(stateWithAttempts);

    expect(result.routingAttempts).toBe(6);
  });

  test("Unit -> executeFallback preserves other state properties", async () => {
    const originalMessages = [new HumanMessage("original")];
    const extendedState = {
      ...defaultState,
      originalMessages,
    };

    const result = await executeFallback(extendedState);

    expect(result).toEqual(
      expect.objectContaining({
        originalMessages,
      })
    );
  });
});
