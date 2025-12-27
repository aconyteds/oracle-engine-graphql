import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ConversationAnalysis } from "../AI/Tools/routing/analyzeConversationContext";
import type { SaveRoutingMetricsParams } from "./saveRoutingMetrics";

describe("saveRoutingMetrics", () => {
  // Declare mock variables
  let mockRoutingMetricCreate: ReturnType<typeof mock>;
  let mockDBClient: {
    routingMetric: {
      create: ReturnType<typeof mock>;
    };
  };
  let saveRoutingMetrics: typeof import("./saveRoutingMetrics").saveRoutingMetrics;

  // Default mock analysis data
  const defaultAnalysis: ConversationAnalysis = {
    analysisType: "conversation_context",
    messageCount: 5,
    topicShifts: [
      {
        from: "general",
        to: "character_creation",
        messageIndex: 2,
        confidence: 0.8,
      },
    ],
    dominantTopics: ["character", "creation"],
    topicStability: 0.75,
    agentPerformance: {
      character_generator: {
        lastUsed: 1,
        successRate: 1.0,
        avgResponseQuality: 4.5,
        userSatisfaction: "positive",
        overuseIndicator: false,
        contextMismatch: 0.1,
      },
    },
    patterns: [
      {
        type: "workflow_continuation",
        description: "User in character creation workflow",
        confidence: 0.9,
        recommendation: "maintain_current_agent",
      },
    ],
    continuityFactors: [
      {
        type: "active_workflow",
        workflow: "character_creation",
        completionPercentage: 0.6,
        description: "Character creation workflow is 60% complete",
        recommendation: "maintain_current_agent",
      },
    ],
    recommendations: [
      "Maintain focus on character_creation with specialized agent",
    ],
  };

  const defaultParams: SaveRoutingMetricsParams = {
    userId: "user-123",
    campaignId: "campaign-456",
    threadId: "thread-789",
    runId: "run-abc",
    analysisTimeMs: 42.5,
    messageCount: 5,
    topicStability: 0.75,
    currentAgent: "default_router",
    availableAgents: ["cheapest", "character_generator"],
    dominantTopics: ["character", "creation"],
    topicShiftCount: 1,
    fullAnalysis: defaultAnalysis,
  };

  beforeEach(async () => {
    // Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockRoutingMetricCreate = mock();
    mockDBClient = {
      routingMetric: {
        create: mockRoutingMetricCreate,
      },
    };

    // Set up module mocks
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./saveRoutingMetrics");
    saveRoutingMetrics = module.saveRoutingMetrics;

    // Configure default mock behavior - successful promise
    mockRoutingMetricCreate.mockResolvedValue({
      id: "metric-id",
      createdAt: new Date(),
      ...defaultParams,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> saveRoutingMetrics calls DBClient.routingMetric.create with correct data", () => {
    saveRoutingMetrics(defaultParams);

    expect(mockRoutingMetricCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        campaignId: "campaign-456",
        threadId: "thread-789",
        runId: "run-abc",
        analysisTimeMs: 42.5,
        messageCount: 5,
        topicStability: 0.75,
        currentAgent: "default_router",
        availableAgents: ["cheapest", "character_generator"],
        dominantTopics: ["character", "creation"],
        topicShiftCount: 1,
        agentPerformanceJson: defaultAnalysis.agentPerformance,
        patternsJson: defaultAnalysis.patterns,
        topicShiftsJson: defaultAnalysis.topicShifts,
        continuityFactorsJson: defaultAnalysis.continuityFactors,
        recommendationsJson: defaultAnalysis.recommendations,
      },
    });
  });

  test("Unit -> saveRoutingMetrics returns void immediately (fire-and-forget)", () => {
    const result = saveRoutingMetrics(defaultParams);

    // Should return undefined (void function)
    expect(result).toBeUndefined();
  });

  test("Unit -> saveRoutingMetrics handles database errors silently", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database connection failed");
    mockRoutingMetricCreate.mockRejectedValue(testError);

    try {
      // Call the function - should not throw
      saveRoutingMetrics(defaultParams);

      // Wait a bit for the async catch block to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify error was logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Routing metrics save failed:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> saveRoutingMetrics saves all analysis data", () => {
    saveRoutingMetrics(defaultParams);

    const callData = mockRoutingMetricCreate.mock.calls[0][0].data;

    // Verify all context identifiers
    expect(callData.userId).toBe("user-123");
    expect(callData.campaignId).toBe("campaign-456");
    expect(callData.threadId).toBe("thread-789");
    expect(callData.runId).toBe("run-abc");

    // Verify all metrics
    expect(callData.analysisTimeMs).toBe(42.5);
    expect(callData.messageCount).toBe(5);
    expect(callData.topicStability).toBe(0.75);

    // Verify agent information
    expect(callData.currentAgent).toBe("default_router");
    expect(callData.availableAgents).toEqual([
      "cheapest",
      "character_generator",
    ]);

    // Verify topic analysis
    expect(callData.dominantTopics).toEqual(["character", "creation"]);
    expect(callData.topicShiftCount).toBe(1);

    // Verify JSON fields
    expect(callData.agentPerformanceJson).toBe(
      defaultAnalysis.agentPerformance
    );
    expect(callData.patternsJson).toBe(defaultAnalysis.patterns);
    expect(callData.topicShiftsJson).toBe(defaultAnalysis.topicShifts);
    expect(callData.continuityFactorsJson).toBe(
      defaultAnalysis.continuityFactors
    );
    expect(callData.recommendationsJson).toBe(defaultAnalysis.recommendations);
  });

  test("Unit -> saveRoutingMetrics handles empty analysis data", () => {
    const emptyAnalysis: ConversationAnalysis = {
      analysisType: "conversation_context",
      messageCount: 0,
      topicShifts: [],
      dominantTopics: [],
      topicStability: 1.0,
      agentPerformance: {},
      patterns: [],
      continuityFactors: [],
      recommendations: [],
    };

    const emptyParams: SaveRoutingMetricsParams = {
      ...defaultParams,
      messageCount: 0,
      topicStability: 1.0,
      dominantTopics: [],
      topicShiftCount: 0,
      fullAnalysis: emptyAnalysis,
    };

    saveRoutingMetrics(emptyParams);

    const callData = mockRoutingMetricCreate.mock.calls[0][0].data;

    expect(callData.messageCount).toBe(0);
    expect(callData.dominantTopics).toEqual([]);
    expect(callData.topicShiftCount).toBe(0);
    expect(callData.agentPerformanceJson).toEqual({});
    expect(callData.patternsJson).toEqual([]);
  });

  test("Unit -> saveRoutingMetrics handles multiple available agents", () => {
    const multiAgentParams: SaveRoutingMetricsParams = {
      ...defaultParams,
      availableAgents: [
        "cheapest",
        "character_generator",
        "location_agent",
        "plot_agent",
      ],
    };

    saveRoutingMetrics(multiAgentParams);

    const callData = mockRoutingMetricCreate.mock.calls[0][0].data;

    expect(callData.availableAgents).toHaveLength(4);
    expect(callData.availableAgents).toContain("cheapest");
    expect(callData.availableAgents).toContain("character_generator");
    expect(callData.availableAgents).toContain("location_agent");
    expect(callData.availableAgents).toContain("plot_agent");
  });

  test("Unit -> saveRoutingMetrics handles complex analysis with multiple patterns", () => {
    const complexAnalysis: ConversationAnalysis = {
      ...defaultAnalysis,
      patterns: [
        {
          type: "escalating_complexity",
          description: "User requests are becoming more complex",
          confidence: 0.85,
          recommendation: "route_to_specialist",
        },
        {
          type: "repeated_failures",
          description: "Multiple routing failures detected",
          confidence: 0.9,
          recommendation: "try_different_agent",
          failureCount: 3,
        },
      ],
    };

    const complexParams: SaveRoutingMetricsParams = {
      ...defaultParams,
      fullAnalysis: complexAnalysis,
    };

    saveRoutingMetrics(complexParams);

    const callData = mockRoutingMetricCreate.mock.calls[0][0].data;

    expect(callData.patternsJson).toHaveLength(2);
    expect(callData.patternsJson[0].type).toBe("escalating_complexity");
    expect(callData.patternsJson[1].type).toBe("repeated_failures");
  });
});
