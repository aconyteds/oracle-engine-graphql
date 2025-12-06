import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ChatOpenAI, type ClientOptions } from "@langchain/openai";
import type { AIAgentDefinition } from "../../types";
import { RouterType } from "../../types";

describe("buildRouterAgent", () => {
  // Mock dependencies - recreated for each test
  let mockRouteToAgent: { name: string };
  let mockAnalyzeConversationContext: { name: string };
  let mockBuildRouterSystemMessage: ReturnType<typeof mock>;
  let buildRouterAgent: (agent: AIAgentDefinition) => AIAgentDefinition;

  const defaultModel = new ChatOpenAI({
    modelName: "gpt-4",
  });

  // Default mock data
  const defaultAgent: AIAgentDefinition = {
    name: "TestAgent",
    model: defaultModel,
    description: "Test agent description",
    specialization: "test specialization",
    systemMessage: "Original system message",
    routerType: RouterType.None,
  };

  const defaultSubAgent: AIAgentDefinition = {
    name: "SubAgent",
    model: new ChatOpenAI({
      model: "gpt-3.5-turbo",
    }),
    description: "Sub agent description",
    specialization: "sub specialization",
    systemMessage: "Sub agent system message",
    routerType: RouterType.None,
  };

  const defaultRouterSystemMessage = "Generated router system message";

  beforeEach(async () => {
    // Restore all mocks before each test
    mock.restore();

    // Create fresh mock objects
    mockRouteToAgent = { name: "routeToAgent" };
    mockAnalyzeConversationContext = { name: "analyzeConversationContext" };
    mockBuildRouterSystemMessage = mock();

    // Set up module mocks
    mock.module("../../Tools/routing", () => ({
      routeToAgent: mockRouteToAgent,
      analyzeConversationContext: mockAnalyzeConversationContext,
    }));

    mock.module("./buildRouterSystemMessage", () => ({
      buildRouterSystemMessage: mockBuildRouterSystemMessage,
    }));

    // Import the module under test after mocks are set up
    const module = await import("./buildRouterAgent");
    buildRouterAgent = module.buildRouterAgent;

    // Configure default mock behavior
    mockBuildRouterSystemMessage.mockReturnValue(defaultRouterSystemMessage);
  });

  afterEach(() => {
    // Restore mocks after each test for complete isolation
    mock.restore();
  });

  test("Unit -> buildRouterAgent returns None router type for agent without sub-agents", () => {
    const agent = { ...defaultAgent };

    const result = buildRouterAgent(agent);

    expect(result).toEqual({
      ...agent,
      routerType: RouterType.None,
    });
    expect(mockBuildRouterSystemMessage).not.toHaveBeenCalled();
  });

  test("Unit -> buildRouterAgent returns None router type for agent with empty sub-agents array", () => {
    const agent = { ...defaultAgent, availableSubAgents: [] };

    const result = buildRouterAgent(agent);

    expect(result).toEqual({
      ...agent,
      routerType: RouterType.None,
    });
    expect(mockBuildRouterSystemMessage).not.toHaveBeenCalled();
  });

  test("Unit -> buildRouterAgent builds router agent with sub-agents and preserves routerType", () => {
    const subAgents = [defaultSubAgent];
    const agent = {
      ...defaultAgent,
      availableSubAgents: subAgents,
      routerType: RouterType.Handoff,
    };

    const result = buildRouterAgent(agent);

    expect(mockBuildRouterSystemMessage).toHaveBeenCalledWith(
      agent.name,
      agent.description,
      subAgents
    );

    expect(result).toEqual({
      ...agent,
      systemMessage: defaultRouterSystemMessage,
      availableTools: [
        mockRouteToAgent,
        mockAnalyzeConversationContext,
      ] as unknown as AIAgentDefinition["availableTools"],
      specialization: agent.specialization,
      routerType: RouterType.Handoff,
    });
  });

  test("Unit -> buildRouterAgent uses fallback description when agent description is undefined", () => {
    const subAgents = [defaultSubAgent];
    const agent = {
      ...defaultAgent,
      description: undefined,
      availableSubAgents: subAgents,
    };

    buildRouterAgent(agent as unknown as AIAgentDefinition);

    expect(mockBuildRouterSystemMessage).toHaveBeenCalledWith(
      agent.name,
      "Intelligent routing agent",
      subAgents
    );
  });

  test("Unit -> buildRouterAgent uses fallback specialization when agent specialization is undefined", () => {
    const subAgents = [defaultSubAgent];
    const agent = {
      ...defaultAgent,
      specialization: undefined,
      availableSubAgents: subAgents,
    };

    const result = buildRouterAgent(agent as unknown as AIAgentDefinition);

    expect(result.specialization).toBe(
      "intelligent request routing and delegation"
    );
  });

  test("Unit -> buildRouterAgent preserves existing specialization when present", () => {
    const subAgents = [defaultSubAgent];
    const agent = { ...defaultAgent, availableSubAgents: subAgents };

    const result = buildRouterAgent(agent);

    expect(result.specialization).toBe(agent.specialization);
  });

  test("Unit -> buildRouterAgent handles multiple sub-agents", () => {
    const subAgents = [
      defaultSubAgent,
      {
        ...defaultSubAgent,
        name: "SubAgent2",
        description: "Second sub agent",
      },
      { ...defaultSubAgent, name: "SubAgent3", description: "Third sub agent" },
    ];
    const agent = {
      ...defaultAgent,
      availableSubAgents: subAgents,
      routerType: RouterType.Handoff,
    };

    const result = buildRouterAgent(agent);

    expect(mockBuildRouterSystemMessage).toHaveBeenCalledWith(
      agent.name,
      agent.description,
      subAgents
    );

    expect(result.routerType).toBe(RouterType.Handoff);
    expect(result.availableTools).toHaveLength(2);
  });

  test("Unit -> buildRouterAgent preserves other agent properties", () => {
    const subAgents = [defaultSubAgent];
    const agent = {
      ...defaultAgent,
      availableSubAgents: subAgents,
      maxRetries: 5,
      retryDelayMs: 1000,
      maxToolCalls: 10,
      maxToolCallTimeMs: 5000,
      clientConfigurationOverrides: { temperature: 0.7 },
    };

    const result = buildRouterAgent(agent as AIAgentDefinition);

    expect(result.maxRetries).toBe(5);
    expect(result.retryDelayMs).toBe(1000);
    expect(result.maxToolCalls).toBe(10);
    expect(result.maxToolCallTimeMs).toBe(5000);
    expect(result.clientConfigurationOverrides).toEqual({
      temperature: 0.7,
    } as ClientOptions);
    expect(result.model).toBe(agent.model);
    expect(result.name).toBe(agent.name);
  });
});
