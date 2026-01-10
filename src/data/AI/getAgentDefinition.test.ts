import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ChatOpenAI } from "@langchain/openai";
import type { AIAgentDefinition, RequestContext } from "./types";
import { RouterType } from "./types";

describe("getAgentDefinition", () => {
  let mockCreateAgent: ReturnType<typeof mock>;
  let mockPrismaCheckpointSaver: ReturnType<typeof mock>;
  let mockSummarizationMiddleware: ReturnType<typeof mock>;
  let mockToolMonitoringMiddleware: ReturnType<typeof mock>;
  let mockToolErrorHandlingMiddleware: ReturnType<typeof mock>;
  let mockEnrichInstructions: ReturnType<typeof mock>;
  // biome-ignore lint/suspicious/noExplicitAny: Mock tool for testing
  let mockYieldProgressTool: any;
  let getAgentDefinition: typeof import("./getAgentDefinition").getAgentDefinition;

  const defaultRequestContext: RequestContext = {
    userId: "user-1",
    campaignId: "campaign-1",
    threadId: "thread-1",
    runId: "run-1",
    yieldMessage: () => {},
  };

  // biome-ignore lint/suspicious/noExplicitAny: Mock tool for testing
  const mockTool: any = {
    name: "calculator",
    description: "Performs calculations",
    call: mock(),
    invoke: mock(),
    _call: mock(),
    schema: {},
  };

  const defaultAgent: AIAgentDefinition = {
    name: "test_agent",
    model: new ChatOpenAI({ modelName: "gpt-4" }),
    description: "A test agent",
    specialization: "testing",
    systemMessage: "You are a test agent",
    routerType: RouterType.None,
    availableTools: [mockTool],
  };

  // biome-ignore lint/suspicious/noExplicitAny: Mock for testing
  const mockAgentInstance: any = {
    invoke: mock(),
    name: "test_agent",
  };

  beforeEach(async () => {
    mock.restore();

    mockCreateAgent = mock().mockReturnValue(mockAgentInstance);
    mockPrismaCheckpointSaver = mock(() => ({
      getTuple: mock(),
    }));
    mockSummarizationMiddleware = mock();
    mockToolMonitoringMiddleware = mock();
    mockToolErrorHandlingMiddleware = mock();
    mockEnrichInstructions = mock();

    mock.module("langchain", () => ({
      createAgent: mockCreateAgent,
      summarizationMiddleware: mockSummarizationMiddleware,
      // biome-ignore lint/suspicious/noExplicitAny: Mock function for testing
      tool: (fn: any, config: any) => ({ ...config, call: fn }),
    }));

    mock.module("./Checkpointers", () => ({
      PrismaCheckpointSaver: mockPrismaCheckpointSaver,
    }));

    mock.module("./schemas", () => ({
      agentContextSchema: { parse: mock() },
      handoffRoutingResponseSchema: { parse: mock() },
    }));

    // Create mock yieldProgressTool
    mockYieldProgressTool = {
      name: "yield_progress",
      description: "Yield progress updates",
      call: mock(),
      invoke: mock(),
      _call: mock(),
      schema: {},
    };

    mock.module("./Tools", () => ({
      toolMonitoringMiddleware: mockToolMonitoringMiddleware,
      toolErrorHandlingMiddleware: mockToolErrorHandlingMiddleware,
      yieldProgressTool: mockYieldProgressTool,
    }));

    mock.module("./enrichInstructions", () => ({
      enrichInstructions: mockEnrichInstructions,
    }));

    const module = await import("./getAgentDefinition");
    getAgentDefinition = module.getAgentDefinition;

    // Default mock behaviors
    mockSummarizationMiddleware.mockReturnValue({
      name: "summarization",
    });
    mockEnrichInstructions.mockImplementation(async ({ systemMessage }) => {
      return systemMessage || "default system message";
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> getAgentDefinition creates basic agent with tools", async () => {
    const result = await getAgentDefinition(
      defaultAgent,
      defaultRequestContext
    );

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test_agent",
        description: "A test agent",
        systemPrompt: "You are a test agent",
        tools: expect.arrayContaining([mockTool, mockYieldProgressTool]),
      })
    );
    expect(result).toBe(mockAgentInstance);
  });

  test("Unit -> getAgentDefinition sets composite thread ID on model with agent name", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(defaultAgent.model.promptCacheKey).toBe(
      "user-1:thread-1:campaign-1:test_agent"
    );
  });

  test("Unit -> getAgentDefinition includes checkpointer", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.checkpointer).toBeDefined();
  });

  test("Unit -> getAgentDefinition includes middleware", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.middleware).toBeDefined();
    expect(Array.isArray(callArgs.middleware)).toBe(true);
    expect(callArgs.middleware.length).toBeGreaterThan(0);
  });

  test("Unit -> getAgentDefinition enriches system message with campaign metadata", async () => {
    const campaignMetadata = {
      name: "Test Campaign",
      setting: "Fantasy World",
      tone: "Epic",
      ruleset: "D&D 5e",
    };

    const contextWithCampaign: RequestContext = {
      ...defaultRequestContext,
      campaignMetadata,
    };

    const enrichedMessage = "Enriched system message with campaign context";
    mockEnrichInstructions.mockResolvedValueOnce(enrichedMessage);

    await getAgentDefinition(defaultAgent, contextWithCampaign);

    expect(mockEnrichInstructions).toHaveBeenCalledWith({
      systemMessage: "You are a test agent",
      campaignMetadata,
    });

    // Verify the enriched message is passed to createAgent
    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.systemPrompt).toBe(enrichedMessage);
  });

  test("Unit -> getAgentDefinition creates agent without tools but includes yieldProgressTool", async () => {
    const agentWithoutTools: AIAgentDefinition = {
      ...defaultAgent,
      availableTools: undefined,
    };

    await getAgentDefinition(agentWithoutTools, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should still have yieldProgressTool even without other tools
    expect(callArgs.tools).toEqual([mockYieldProgressTool]);
  });

  test("Unit -> getAgentDefinition handles Handoff router with response format", async () => {
    const handoffAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Handoff,
    };

    await getAgentDefinition(handoffAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.responseFormat).toBeDefined();
  });

  test("Unit -> getAgentDefinition handles Controller router with sub-agents", async () => {
    const subAgent: AIAgentDefinition = {
      name: "sub_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "A sub agent",
      specialization: "sub-tasks",
      systemMessage: "You are a sub agent",
      routerType: RouterType.None,
    };

    const controllerAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Controller,
      availableSubAgents: [subAgent],
    };

    await getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have original tool + yieldProgressTool + sub-agent tool = 3 tools
    expect(callArgs.tools.length).toBe(3);
  });

  test("Unit -> getAgentDefinition throws error when Controller has Handoff sub-agent", async () => {
    const handoffSubAgent: AIAgentDefinition = {
      name: "handoff_sub",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "A handoff sub agent",
      specialization: "routing",
      systemMessage: "Router agent",
      routerType: RouterType.Handoff,
    };

    const controllerAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Controller,
      availableSubAgents: [handoffSubAgent],
    };

    expect(() =>
      getAgentDefinition(controllerAgent, defaultRequestContext)
    ).toThrow(
      "Configuration Error: Controller agent 'test_agent' cannot have Handoff sub-agent 'handoff_sub'."
    );
  });

  test("Unit -> getAgentDefinition creates sub-agent tool with correct schema", async () => {
    const subAgent: AIAgentDefinition = {
      name: "specialized_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "Handles specialized tasks",
      specialization: "specialized tasks",
      systemMessage: "You are specialized",
      routerType: RouterType.None,
    };

    const controllerAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Controller,
      availableSubAgents: [subAgent],
      availableTools: [],
    };

    await getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have yieldProgressTool + sub-agent tool = 2 tools
    expect(callArgs.tools.length).toBe(2);
    // Find the specialized_agent tool (not yieldProgressTool)
    const subAgentTool = callArgs.tools.find(
      // biome-ignore lint/suspicious/noExplicitAny: Mock tool type
      (t: any) => t.name === "specialized_agent"
    );
    expect(subAgentTool).toBeDefined();
    expect(subAgentTool.description).toBe("Handles specialized tasks");
  });

  test("Unit -> getAgentDefinition uses checkpointer", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have a checkpointer assigned
    expect(callArgs.checkpointer).toBeDefined();
  });

  test("Unit -> getAgentDefinition handles agent with multiple sub-agents", async () => {
    const subAgent1: AIAgentDefinition = {
      name: "sub_agent_1",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "First sub agent",
      specialization: "task 1",
      systemMessage: "Sub agent 1",
      routerType: RouterType.None,
    };

    const subAgent2: AIAgentDefinition = {
      name: "sub_agent_2",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "Second sub agent",
      specialization: "task 2",
      systemMessage: "Sub agent 2",
      routerType: RouterType.None,
    };

    const controllerAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Controller,
      availableSubAgents: [subAgent1, subAgent2],
      availableTools: [],
    };

    await getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have yieldProgressTool + 2 sub-agent tools = 3 tools
    expect(callArgs.tools.length).toBe(3);
    const toolNames = callArgs.tools.map(
      // biome-ignore lint/suspicious/noExplicitAny: Mock tool type
      (t: any) => t.name
    );
    expect(toolNames).toContain("sub_agent_1");
    expect(toolNames).toContain("sub_agent_2");
    expect(toolNames).toContain("yield_progress");
  });

  test("Unit -> getAgentDefinition handles Controller with both tools and sub-agents", async () => {
    const subAgent: AIAgentDefinition = {
      name: "sub_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "A sub agent",
      specialization: "sub-tasks",
      systemMessage: "Sub agent",
      routerType: RouterType.None,
    };

    const controllerAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Controller,
      availableSubAgents: [subAgent],
      availableTools: [mockTool],
    };

    await getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have original tool + yieldProgressTool + sub-agent tool = 3 tools
    expect(callArgs.tools.length).toBe(3);
  });

  test("Unit -> getAgentDefinition does not set responseFormat for non-Handoff routers", async () => {
    const nonHandoffAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.None,
    };

    await getAgentDefinition(nonHandoffAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.responseFormat).toBeUndefined();
  });

  test("Unit -> getAgentDefinition does not create sub-agent tools for non-Controller", async () => {
    const subAgent: AIAgentDefinition = {
      name: "sub_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "A sub agent",
      specialization: "sub-tasks",
      systemMessage: "Sub agent",
      routerType: RouterType.None,
    };

    // Non-controller agent with sub-agents (should be ignored)
    const regularAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.None,
      availableSubAgents: [subAgent],
      availableTools: [mockTool],
    };

    await getAgentDefinition(regularAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have original tool + yieldProgressTool = 2 tools (no sub-agent tools)
    expect(callArgs.tools.length).toBe(2);
    expect(callArgs.tools).toContain(mockTool);
    expect(callArgs.tools).toContain(mockYieldProgressTool);
  });

  test("Unit -> getAgentDefinition passes contextSchema to createAgent", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.contextSchema).toBeDefined();
  });

  test("Unit -> getAgentDefinition configures summarization middleware", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(mockSummarizationMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(ChatOpenAI),
        trigger: expect.objectContaining({ tokens: 100_000 }),
        keep: expect.objectContaining({ tokens: 10_000 }),
      })
    );
  });

  test("Unit -> getAgentDefinition includes toolMonitoringMiddleware", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.middleware).toContain(mockToolMonitoringMiddleware);
  });

  test("Unit -> getAgentDefinition works without requestContext", async () => {
    const agentWithoutContext: AIAgentDefinition = {
      ...defaultAgent,
      model: new ChatOpenAI({ modelName: "gpt-4" }),
    };

    const result = await getAgentDefinition(agentWithoutContext);

    expect(mockCreateAgent).toHaveBeenCalled();
    expect(result).toBe(mockAgentInstance);
    // Model should not have promptCacheKey set when no context provided
    expect(agentWithoutContext.model.promptCacheKey).toBeUndefined();
  });

  test("Unit -> getAgentDefinition uses agent name in composite thread ID", async () => {
    const customAgent: AIAgentDefinition = {
      ...defaultAgent,
      name: "custom_agent_name",
    };

    await getAgentDefinition(customAgent, defaultRequestContext);

    expect(customAgent.model.promptCacheKey).toBe(
      "user-1:thread-1:campaign-1:custom_agent_name"
    );
  });

  test("Unit -> getAgentDefinition configures summarization with summary suffix in cache key", async () => {
    await getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(mockSummarizationMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({
          promptCacheKey: "user-1:thread-1:campaign-1:test_agent:summary",
        }),
      })
    );
  });

  test("Unit -> getAgentDefinition configures summarization without cache key when no context", async () => {
    const agentWithoutContext: AIAgentDefinition = {
      ...defaultAgent,
      name: "no_context_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
    };

    await getAgentDefinition(agentWithoutContext);

    // The summarization model should be created without promptCacheKey property
    const callArgs =
      mockSummarizationMiddleware.mock.calls[
        mockSummarizationMiddleware.mock.calls.length - 1
      ][0];
    expect(callArgs.model.promptCacheKey).toBeUndefined();
  });

  test("Unit -> getAgentDefinition always includes yieldProgressTool", async () => {
    const agentWithNoTools: AIAgentDefinition = {
      ...defaultAgent,
      availableTools: [],
    };

    await getAgentDefinition(agentWithNoTools, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.tools).toContain(mockYieldProgressTool);
  });

  test("Unit -> getAgentDefinition prevents duplicate tools using Set", async () => {
    // This test verifies that the Set prevents duplicate tools
    const agentWithDuplicateTools: AIAgentDefinition = {
      ...defaultAgent,
      availableTools: [mockTool, mockTool], // Same tool twice
    };

    await getAgentDefinition(agentWithDuplicateTools, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have mockTool once + yieldProgressTool = 2 tools
    expect(callArgs.tools.length).toBe(2);
    expect(callArgs.tools).toContain(mockTool);
    expect(callArgs.tools).toContain(mockYieldProgressTool);
  });

  test("Unit -> getAgentDefinition includes yieldProgressTool for Handoff routers", async () => {
    const handoffAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Handoff,
      availableTools: [],
    };

    await getAgentDefinition(handoffAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.tools).toContain(mockYieldProgressTool);
    expect(callArgs.responseFormat).toBeDefined();
  });

  test("Unit -> getAgentDefinition includes yieldProgressTool for Controller routers", async () => {
    const subAgent: AIAgentDefinition = {
      name: "sub_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
      description: "A sub agent",
      specialization: "sub-tasks",
      systemMessage: "Sub agent",
      routerType: RouterType.None,
    };

    const controllerAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Controller,
      availableSubAgents: [subAgent],
      availableTools: [],
    };

    await getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.tools).toContain(mockYieldProgressTool);
    // Should have yieldProgressTool + sub-agent tool
    expect(callArgs.tools.length).toBe(2);
  });
});
