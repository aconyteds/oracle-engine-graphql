import { test, expect, beforeEach, mock, afterEach, describe } from "bun:test";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import type { AIAgentDefinition } from "../types";

describe("analyzeAndRoute", () => {
  let mockGetModelDefinition: ReturnType<typeof mock>;
  let mockRunToolEnabledWorkflow: ReturnType<typeof mock>;
  let mockGetAgentByName: ReturnType<typeof mock>;
  let analyzeAndRoute: typeof import("./analyzeAndRoute").analyzeAndRoute;

  const mockRouterAgent = {
    name: "router-agent",
    description: "Router agent",
    availableTools: [{ name: "routeToAgent" }],
  } as AIAgentDefinition;

  const mockTargetAgent = {
    name: "target-agent",
    description: "Target agent",
  } as AIAgentDefinition;

  const mockCheapestAgent = {
    name: "cheapest",
    description: "Cheapest agent",
  } as AIAgentDefinition;

  const mockModel = {
    invoke: mock(),
  };

  const defaultState = {
    messages: [{ content: "Test message" }],
    runId: "test-run-123",
    routingAttempts: 0,
    routerAgent: mockRouterAgent,
  } as typeof RouterGraphState.State;

  const defaultWorkflowResult = {
    toolResultsForDB: [
      {
        toolName: "routeToAgent",
        result: JSON.stringify({
          type: "routing_decision",
          targetAgent: "target-agent",
          confidence: 4.25,
          reasoning: "Best match for request",
          fallbackAgent: "cheapest",
          intentKeywords: ["help", "question"],
          contextFactors: ["user_intent"],
          timestamp: "2024-01-01T12:00:00Z",
        }),
      },
    ],
  };

  beforeEach(async () => {
    mock.restore();

    mockGetModelDefinition = mock();
    mockRunToolEnabledWorkflow = mock();
    mockGetAgentByName = mock();

    mock.module("../getModelDefinition", () => ({
      getModelDefinition: mockGetModelDefinition,
    }));

    mock.module("../Workflows/toolEnabledWorkflow", () => ({
      runToolEnabledWorkflow: mockRunToolEnabledWorkflow,
    }));

    mock.module("../agentList", () => ({
      getAgentByName: mockGetAgentByName,
    }));

    mock.module("../Agents", () => ({
      cheapest: mockCheapestAgent,
    }));

    const module = await import("./analyzeAndRoute");
    analyzeAndRoute = module.analyzeAndRoute;

    mockGetModelDefinition.mockClear();
    mockRunToolEnabledWorkflow.mockClear();
    mockGetAgentByName.mockClear();

    mockGetModelDefinition.mockReturnValue(mockModel);
    mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
    mockGetAgentByName.mockImplementation((name: string) => {
      if (name === "target-agent") return mockTargetAgent;
      if (name === "cheapest") return mockCheapestAgent;
      return null;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> analyzeAndRoute executes router agent successfully", async () => {
    const result = await analyzeAndRoute(defaultState);

    expect(mockGetModelDefinition).toHaveBeenCalledWith(mockRouterAgent);
    expect(mockRunToolEnabledWorkflow).toHaveBeenCalledWith({
      messages: defaultState.messages,
      threadId: "test-run-123",
      agent: mockRouterAgent,
      tools: mockRouterAgent.availableTools,
    });
    expect(result.routingAttempts).toBe(1);
    expect(result.routingMetadata?.success).toBe(true);
    expect(result.routingMetadata?.fallbackUsed).toBe(false);
  });

  test("Unit -> analyzeAndRoute extracts routing decision from tool results", async () => {
    const result = await analyzeAndRoute(defaultState);

    expect(result.routingDecision).toBeDefined();
    expect(result.routingDecision?.targetAgent).toBe(mockTargetAgent);
    expect(result.routingDecision?.confidence).toBe(4.25);
    expect(result.routingDecision?.reasoning).toBe("Best match for request");
    expect(result.routingDecision?.fallbackAgent).toBe(mockCheapestAgent);
    expect(result.routingDecision?.intentKeywords).toEqual([
      "help",
      "question",
    ]);
    expect(result.routingDecision?.contextFactors).toEqual(["user_intent"]);
  });

  test("Unit -> analyzeAndRoute creates fallback decision when no router agent provided", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const stateWithoutRouter = {
      ...defaultState,
      routerAgent: null,
    };

    try {
      const result = await analyzeAndRoute(stateWithoutRouter);

      expect(result.routingDecision?.targetAgent).toBe(mockCheapestAgent);
      expect(result.routingDecision?.confidence).toBe(50);
      expect(result.routingDecision?.reasoning).toBe(
        "Router analysis failed, using default agent"
      );
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(true);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> analyzeAndRoute creates fallback decision when router model not configured", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockGetModelDefinition.mockReturnValue(null);

    try {
      const result = await analyzeAndRoute(defaultState);

      expect(result.routingDecision?.targetAgent).toBe(mockCheapestAgent);
      expect(result.routingDecision?.confidence).toBe(50);
      expect(result.routingDecision?.reasoning).toBe(
        "Router analysis failed, using default agent"
      );
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(true);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> analyzeAndRoute handles router analysis failure", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Router execution failed");
    mockRunToolEnabledWorkflow.mockRejectedValue(testError);

    try {
      const result = await analyzeAndRoute(defaultState);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Router analysis failed:",
        testError
      );
      expect(result.routingDecision?.targetAgent).toBe(mockCheapestAgent);
      expect(result.routingDecision?.confidence).toBe(50);
      expect(result.routingDecision?.reasoning).toBe(
        "Router analysis failed, using default agent"
      );
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(true);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> analyzeAndRoute handles missing target agent", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockGetAgentByName.mockImplementation((name: string) => {
      if (name === "target-agent") return null; // Agent not found
      if (name === "cheapest") return mockCheapestAgent;
      return null;
    });

    try {
      const result = await analyzeAndRoute(defaultState);

      expect(result.routingDecision).toBeNull();
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to extract routing decision:",
        expect.any(Error)
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> analyzeAndRoute handles missing fallback agent", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockGetAgentByName.mockImplementation((name: string) => {
      if (name === "target-agent") return mockTargetAgent;
      if (name === "cheapest") return mockCheapestAgent;
      if (name === "nonexistent-fallback") return null; // Fallback not found
      return null;
    });

    const workflowWithBadFallback = {
      toolResultsForDB: [
        {
          toolName: "routeToAgent",
          result: JSON.stringify({
            type: "routing_decision",
            targetAgent: "target-agent",
            confidence: 4.25,
            reasoning: "Best match",
            fallbackAgent: "nonexistent-fallback",
            intentKeywords: [],
            contextFactors: [],
            timestamp: "2024-01-01T12:00:00Z",
          }),
        },
      ],
    };
    mockRunToolEnabledWorkflow.mockResolvedValue(workflowWithBadFallback);

    try {
      const result = await analyzeAndRoute(defaultState);

      expect(result.routingDecision).toBeNull();
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to extract routing decision:",
        expect.any(Error)
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> analyzeAndRoute handles no routing tool results", async () => {
    const workflowWithoutRouting = {
      toolResultsForDB: [
        {
          toolName: "other-tool",
          result: "some result",
        },
      ],
    };
    mockRunToolEnabledWorkflow.mockResolvedValue(workflowWithoutRouting);

    const result = await analyzeAndRoute(defaultState);

    expect(result.routingDecision).toBeNull();
    expect(result.routingMetadata?.success).toBe(false);
    expect(result.routingMetadata?.fallbackUsed).toBe(false);
  });

  test("Unit -> analyzeAndRoute handles invalid JSON in tool results", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const workflowWithInvalidJSON = {
      toolResultsForDB: [
        {
          toolName: "routeToAgent",
          result: "invalid json {",
        },
      ],
    };
    mockRunToolEnabledWorkflow.mockResolvedValue(workflowWithInvalidJSON);

    try {
      const result = await analyzeAndRoute(defaultState);

      expect(result.routingDecision).toBeNull();
      expect(result.routingMetadata?.success).toBe(false);
      expect(result.routingMetadata?.fallbackUsed).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to extract routing decision:",
        expect.any(Error)
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> analyzeAndRoute measures execution time", async () => {
    const result = await analyzeAndRoute(defaultState);

    expect(result.routingMetadata?.executionTime).toBeGreaterThanOrEqual(0);
    expect(typeof result.routingMetadata?.executionTime).toBe("number");
  });

  test("Unit -> analyzeAndRoute preserves other state properties", async () => {
    const extendedState = {
      ...defaultState,
      customField: "value",
      messages: ["message1", "message2"],
      maxRoutingAttempts: 3,
    };

    const result = await analyzeAndRoute(extendedState);

    expect(result).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        customField: "value",
        messages: ["message1", "message2"],
        maxRoutingAttempts: 3,
      })
    );
  });

  test("Unit -> analyzeAndRoute uses default fallback when not specified", async () => {
    const workflowWithoutFallback = {
      toolResultsForDB: [
        {
          toolName: "routeToAgent",
          result: JSON.stringify({
            type: "routing_decision",
            targetAgent: "target-agent",
            confidence: 4.25,
            reasoning: "Best match",
            fallbackAgent: "", // Empty fallback
            intentKeywords: [],
            contextFactors: [],
            timestamp: "2024-01-01T12:00:00Z",
          }),
        },
      ],
    };
    mockRunToolEnabledWorkflow.mockResolvedValue(workflowWithoutFallback);

    const result = await analyzeAndRoute(defaultState);

    expect(result.routingDecision?.fallbackAgent).toBe(mockCheapestAgent);
  });
});
