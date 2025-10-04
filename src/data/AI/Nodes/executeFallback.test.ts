import { test, expect, beforeEach, mock, describe, afterAll } from "bun:test";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import type { AIAgentDefinition } from "../types";

const mockGetModelDefinition = mock();
const mockRunToolEnabledWorkflow = mock();

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

void mock.module("../getModelDefinition", () => ({
  getModelDefinition: mockGetModelDefinition,
}));

void mock.module("../Workflows/toolEnabledWorkflow", () => ({
  runToolEnabledWorkflow: mockRunToolEnabledWorkflow,
}));

void mock.module("../Agents", () => ({
  cheapest: mockCheapestAgent,
}));

import { executeFallback } from "./executeFallback";

describe("executeFallback", () => {
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

  beforeEach(() => {
    mockGetModelDefinition.mockClear();
    mockRunToolEnabledWorkflow.mockClear();

    mockGetModelDefinition.mockReturnValue(mockModel);
    mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
  });

  afterAll(() => {
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
      routingDecision: {},
    };

    const result = await executeFallback(stateWithoutFallback);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockCheapestAgent);
    expect(result.targetAgent).toBe(mockCheapestAgent);
  });

  test("Unit -> executeFallback uses cheapest agent when routing decision is null", async () => {
    const stateWithoutDecision = {
      ...defaultState,
      routingDecision: null,
    };

    const result = await executeFallback(stateWithoutDecision);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockCheapestAgent);
    expect(result.targetAgent).toBe(mockCheapestAgent);
  });

  test("Unit -> executeFallback handles model configuration error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockGetModelDefinition.mockReturnValue(null);

    try {
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
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> executeFallback handles workflow execution error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Workflow execution failed");
    mockRunToolEnabledWorkflow.mockRejectedValue(testError);

    try {
      const result = await executeFallback(defaultState);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to execute fallback agent:",
        testError
      );
      expect(result.currentResponse).toBe(
        "I apologize, but I'm experiencing technical difficulties. Please try again."
      );
      expect(result.routingMetadata?.success).toBe(false);
    } finally {
      console.error = originalConsoleError;
    }
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
        decision: { targetAgent: "previous-agent" },
        executionTime: 200,
        success: false,
        fallbackUsed: false,
        customField: "preserved",
      },
    };

    const result = await executeFallback(stateWithMetadata);

    expect(result.routingMetadata).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        decision: { targetAgent: "previous-agent" },
        executionTime: 200,
        customField: "preserved",
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
    const extendedState = {
      ...defaultState,
      customField: "value",
      originalMessages: [{ content: "original" }],
      maxRoutingAttempts: 3,
    };

    const result = await executeFallback(extendedState);

    expect(result).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        customField: "value",
        originalMessages: [{ content: "original" }],
        maxRoutingAttempts: 3,
      })
    );
  });
});
