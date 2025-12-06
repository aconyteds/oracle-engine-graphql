import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ChatOpenAI } from "@langchain/openai";
import type { AIAgentDefinition, RequestContext } from "./types";
import { RouterType } from "./types";

describe("getAgentDefinition", () => {
  let mockCreateAgent: ReturnType<typeof mock>;
  let mockPrismaCheckpointSaver: ReturnType<typeof mock>;
  let mockSummarizationMiddleware: ReturnType<typeof mock>;
  let mockToolMonitoringMiddleware: ReturnType<typeof mock>;
  let getAgentDefinition: typeof import("./getAgentDefinition").getAgentDefinition;

  const defaultRequestContext: RequestContext = {
    userId: "user-1",
    campaignId: "campaign-1",
    threadId: "thread-1",
    runId: "run-1",
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

    mock.module("./Tools", () => ({
      toolMonitoringMiddleware: mockToolMonitoringMiddleware,
    }));

    const module = await import("./getAgentDefinition");
    getAgentDefinition = module.getAgentDefinition;

    // Default mock behaviors
    mockSummarizationMiddleware.mockReturnValue({
      name: "summarization",
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> getAgentDefinition creates basic agent with tools", () => {
    const result = getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test_agent",
        description: "A test agent",
        systemPrompt: "You are a test agent",
        tools: [mockTool],
      })
    );
    expect(result).toBe(mockAgentInstance);
  });

  test("Unit -> getAgentDefinition sets composite thread ID on model with agent name", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(defaultAgent.model.promptCacheKey).toBe(
      "user-1:thread-1:campaign-1:test_agent"
    );
  });

  test("Unit -> getAgentDefinition includes checkpointer", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.checkpointer).toBeDefined();
  });

  test("Unit -> getAgentDefinition includes middleware", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.middleware).toBeDefined();
    expect(Array.isArray(callArgs.middleware)).toBe(true);
    expect(callArgs.middleware.length).toBeGreaterThan(0);
  });

  test("Unit -> getAgentDefinition creates agent without tools", () => {
    const agentWithoutTools: AIAgentDefinition = {
      ...defaultAgent,
      availableTools: undefined,
    };

    getAgentDefinition(agentWithoutTools, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.tools).toEqual([]);
  });

  test("Unit -> getAgentDefinition handles Handoff router with response format", () => {
    const handoffAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.Handoff,
    };

    getAgentDefinition(handoffAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.responseFormat).toBeDefined();
  });

  test("Unit -> getAgentDefinition handles Controller router with sub-agents", () => {
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

    getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have original tools plus sub-agent tools
    expect(callArgs.tools.length).toBeGreaterThan(1);
  });

  test("Unit -> getAgentDefinition throws error when Controller has Handoff sub-agent", () => {
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

  test("Unit -> getAgentDefinition creates sub-agent tool with correct schema", () => {
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

    getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.tools.length).toBe(1);
    expect(callArgs.tools[0].name).toBe("specialized_agent");
    expect(callArgs.tools[0].description).toBe("Handles specialized tasks");
  });

  test("Unit -> getAgentDefinition uses checkpointer", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have a checkpointer assigned
    expect(callArgs.checkpointer).toBeDefined();
  });

  test("Unit -> getAgentDefinition handles agent with multiple sub-agents", () => {
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

    getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.tools.length).toBe(2);
    expect(callArgs.tools[0].name).toBe("sub_agent_1");
    expect(callArgs.tools[1].name).toBe("sub_agent_2");
  });

  test("Unit -> getAgentDefinition handles Controller with both tools and sub-agents", () => {
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

    getAgentDefinition(controllerAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should have original tool + sub-agent tool
    expect(callArgs.tools.length).toBe(2);
  });

  test("Unit -> getAgentDefinition does not set responseFormat for non-Handoff routers", () => {
    const nonHandoffAgent: AIAgentDefinition = {
      ...defaultAgent,
      routerType: RouterType.None,
    };

    getAgentDefinition(nonHandoffAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.responseFormat).toBeUndefined();
  });

  test("Unit -> getAgentDefinition does not create sub-agent tools for non-Controller", () => {
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

    getAgentDefinition(regularAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    // Should only have the original tool, not sub-agent tools
    expect(callArgs.tools.length).toBe(1);
    expect(callArgs.tools[0]).toBe(mockTool);
  });

  test("Unit -> getAgentDefinition passes contextSchema to createAgent", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.contextSchema).toBeDefined();
  });

  test("Unit -> getAgentDefinition configures summarization middleware", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(mockSummarizationMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(ChatOpenAI),
        trigger: expect.objectContaining({ tokens: 100_000 }),
        keep: expect.objectContaining({ tokens: 10_000 }),
      })
    );
  });

  test("Unit -> getAgentDefinition includes toolMonitoringMiddleware", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    const callArgs = mockCreateAgent.mock.calls[0][0];
    expect(callArgs.middleware).toContain(mockToolMonitoringMiddleware);
  });

  test("Unit -> getAgentDefinition works without requestContext", () => {
    const agentWithoutContext: AIAgentDefinition = {
      ...defaultAgent,
      model: new ChatOpenAI({ modelName: "gpt-4" }),
    };

    const result = getAgentDefinition(agentWithoutContext);

    expect(mockCreateAgent).toHaveBeenCalled();
    expect(result).toBe(mockAgentInstance);
    // Model should not have promptCacheKey set when no context provided
    expect(agentWithoutContext.model.promptCacheKey).toBeUndefined();
  });

  test("Unit -> getAgentDefinition uses agent name in composite thread ID", () => {
    const customAgent: AIAgentDefinition = {
      ...defaultAgent,
      name: "custom_agent_name",
    };

    getAgentDefinition(customAgent, defaultRequestContext);

    expect(customAgent.model.promptCacheKey).toBe(
      "user-1:thread-1:campaign-1:custom_agent_name"
    );
  });

  test("Unit -> getAgentDefinition configures summarization with summary suffix in cache key", () => {
    getAgentDefinition(defaultAgent, defaultRequestContext);

    expect(mockSummarizationMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({
          promptCacheKey: "user-1:thread-1:campaign-1:test_agent:summary",
        }),
      })
    );
  });

  test("Unit -> getAgentDefinition configures summarization without cache key when no context", () => {
    const agentWithoutContext: AIAgentDefinition = {
      ...defaultAgent,
      name: "no_context_agent",
      model: new ChatOpenAI({ modelName: "gpt-4" }),
    };

    getAgentDefinition(agentWithoutContext);

    // The summarization model should be created without promptCacheKey property
    const callArgs =
      mockSummarizationMiddleware.mock.calls[
        mockSummarizationMiddleware.mock.calls.length - 1
      ][0];
    expect(callArgs.model.promptCacheKey).toBeUndefined();
  });
});
