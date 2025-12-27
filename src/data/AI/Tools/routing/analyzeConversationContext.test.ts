import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AIAgentDefinition } from "../../types";
import { RouterType } from "../../types";
import type { ConversationAnalysis } from "./analyzeConversationContext";

describe("analyzeConversationContext", () => {
  // Declare mock variables
  let mockGetAgentByName: ReturnType<typeof mock>;
  let mockSaveRoutingMetrics: ReturnType<typeof mock>;
  let analyzeConversationContext: typeof import("./analyzeConversationContext").analyzeConversationContext;

  // Mock model (simplified for testing)
  const mockModel = {} as AIAgentDefinition["model"];

  // Mock agent configurations
  const mockCharacterAgent: AIAgentDefinition = {
    name: "character_generator",
    model: mockModel,
    description: "Character creation agent",
    specialization: "character creation and management",
    systemMessage: "You help create characters",
    routerType: RouterType.None,
  };

  const mockLocationAgent: AIAgentDefinition = {
    name: "location_agent",
    model: mockModel,
    description: "Location management agent",
    specialization: "location-based campaign assets",
    systemMessage: "You help with locations",
    routerType: RouterType.None,
  };

  const mockRouterAgent: AIAgentDefinition = {
    name: "default_router",
    model: mockModel,
    description: "Router agent",
    specialization: "intelligent request routing",
    systemMessage: "You route requests",
    availableSubAgents: [mockCharacterAgent, mockLocationAgent],
    routerType: RouterType.Handoff,
  };

  const mockSimpleAgent: AIAgentDefinition = {
    name: "simple_agent",
    model: mockModel,
    description: "Simple agent with no sub-agents",
    specialization: "general questions",
    systemMessage: "You help with general tasks",
    routerType: RouterType.None,
  };

  // Helper to create messages
  const createMessage = (
    id: string,
    content: string,
    role: "user" | "assistant" | "system",
    createdAt: string
  ) => ({
    id,
    content,
    role,
    createdAt,
    routingMetadata: null,
  });

  // Mock context
  const mockContext = {
    userId: "user-123",
    campaignId: "campaign-456",
    threadId: "thread-789",
    runId: "run-abc",
  };

  beforeEach(async () => {
    // Restore all mocks
    mock.restore();

    // Create fresh mocks
    mockGetAgentByName = mock();
    mockSaveRoutingMetrics = mock();

    // Set up module mocks
    mock.module("../../agentList", () => ({
      getAgentByName: mockGetAgentByName,
    }));

    mock.module("../../../MongoDB/saveRoutingMetrics", () => ({
      saveRoutingMetrics: mockSaveRoutingMetrics,
    }));

    // Dynamically import the module under test
    const module = await import("./analyzeConversationContext");
    analyzeConversationContext = module.analyzeConversationContext;

    // Default: router agent with sub-agents
    mockGetAgentByName.mockReturnValue(mockRouterAgent);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> analyzeConversationContext returns empty analysis when agent has no sub-agents", async () => {
    mockGetAgentByName.mockReturnValue(mockSimpleAgent);

    const result = await analyzeConversationContext.invoke(
      {
        currentAgentName: "simple_agent",
        messageCount: 5,
        messages: [],
      },
      { context: mockContext }
    );

    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.analysisType).toBe("conversation_context");
    expect(parsed.messageCount).toBe(0);
    expect(parsed.recommendations).toContain(
      "No sub-agents available for routing analysis - agent operates independently"
    );

    // Verify metrics were saved
    expect(mockSaveRoutingMetrics).toHaveBeenCalled();
  });

  test("Unit -> analyzeConversationContext returns empty analysis for no messages", async () => {
    const result = await analyzeConversationContext.invoke(
      {
        currentAgentName: "default_router",
        messageCount: 5,
        messages: [],
      },
      { context: mockContext }
    );

    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.analysisType).toBe("conversation_context");
    expect(parsed.messageCount).toBe(0);
    expect(parsed.topicShifts).toEqual([]);
    expect(parsed.dominantTopics).toEqual([]);
    expect(parsed.topicStability).toBe(1.0);
    expect(parsed.agentPerformance).toEqual({});
    expect(parsed.patterns).toEqual([]);
    expect(parsed.continuityFactors).toEqual([]);
    expect(parsed.recommendations).toEqual([
      "No conversation history available for analysis",
    ]);

    // Verify metrics were saved
    expect(mockSaveRoutingMetrics).toHaveBeenCalled();
  });

  test("Unit -> analyzeConversationContext analyzes messages with dynamic topic mapping", async () => {
    const messages = [
      createMessage(
        "1",
        "Create a character for me",
        "user",
        "2024-01-01T10:00:00Z"
      ),
      createMessage(
        "2",
        "Here's a character",
        "assistant",
        "2024-01-01T10:01:00Z"
      ),
      createMessage(
        "3",
        "Tell me about a location in the campaign",
        "user",
        "2024-01-01T10:02:00Z"
      ),
    ];

    const result = await analyzeConversationContext.invoke(
      {
        currentAgentName: "default_router",
        messageCount: 5,
        messages,
      },
      { context: mockContext }
    );

    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.analysisType).toBe("conversation_context");
    expect(parsed.messageCount).toBe(3);

    // Verify metrics were saved with correct parameters
    expect(mockSaveRoutingMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        campaignId: "campaign-456",
        threadId: "thread-789",
        runId: "run-abc",
        currentAgent: "default_router",
        availableAgents: ["character_generator", "location_agent"],
        messageCount: 3,
      })
    );
  });

  test("Unit -> analyzeConversationContext uses dynamic agent lookup", async () => {
    mockGetAgentByName.mockReturnValue(mockRouterAgent);

    await analyzeConversationContext.invoke(
      {
        currentAgentName: "default_router",
        messageCount: 5,
        messages: [],
      },
      { context: mockContext }
    );

    // Verify agent lookup was called
    expect(mockGetAgentByName).toHaveBeenCalledWith("default_router");
  });

  test("Unit -> analyzeConversationContext extracts context from config", async () => {
    const customContext = {
      userId: "custom-user",
      campaignId: "custom-campaign",
      threadId: "custom-thread",
      runId: "custom-run",
    };

    await analyzeConversationContext.invoke(
      {
        currentAgentName: "default_router",
        messageCount: 5,
        messages: [],
      },
      { context: customContext }
    );

    // Verify metrics received the custom context
    expect(mockSaveRoutingMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "custom-user",
        campaignId: "custom-campaign",
        threadId: "custom-thread",
        runId: "custom-run",
      })
    );
  });

  test("Unit -> analyzeConversationContext validates messageCount", async () => {
    await expect(
      analyzeConversationContext.invoke(
        {
          currentAgentName: "default_router",
          messageCount: 0, // Invalid
          messages: [],
        },
        { context: mockContext }
      )
    ).rejects.toThrow("expected number to be >=1");

    await expect(
      analyzeConversationContext.invoke(
        {
          currentAgentName: "default_router",
          messageCount: 11, // Too high
          messages: [],
        },
        { context: mockContext }
      )
    ).rejects.toThrow("expected number to be <=10");
  });

  test("Unit -> analyzeConversationContext generates recommendations", async () => {
    const messages = [
      createMessage("1", "Create a character", "user", "2024-01-01T10:00:00Z"),
      createMessage(
        "2",
        "Here's a character",
        "assistant",
        "2024-01-01T10:01:00Z"
      ),
    ];

    const result = await analyzeConversationContext.invoke(
      {
        currentAgentName: "default_router",
        messageCount: 5,
        messages,
      },
      { context: mockContext }
    );

    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.recommendations).toBeDefined();
    expect(Array.isArray(parsed.recommendations)).toBe(true);
    expect(parsed.recommendations.length).toBeGreaterThan(0);
  });
});
