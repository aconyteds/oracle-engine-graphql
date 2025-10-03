import { test, expect, beforeEach, mock } from "bun:test";
import type { AIAgentDefinition } from "../../types";

// Mock dependencies
const mockRouteToAgent = { name: "routeToAgent" };
const mockAnalyzeConversationContext = { name: "analyzeConversationContext" };
const mockBuildRouterSystemMessage = mock();

void mock.module("../../Tools/routing", () => ({
  routeToAgent: mockRouteToAgent,
  analyzeConversationContext: mockAnalyzeConversationContext,
}));

void mock.module("./buildRouterSystemMessage", () => ({
  buildRouterSystemMessage: mockBuildRouterSystemMessage,
}));

import { buildRouterAgent } from "./buildRouterAgent";
import type { TrustedModel } from "../../modelList";
import type { ClientOptions } from "@langchain/openai";
import type { Tool } from "@langchain/core/dist/tools";

const defaultModel: TrustedModel = {
  modelName: "gpt-4",
  modelProvider: "OpenAI",
  contextWindow: 8192,
};
// Default mock data
const defaultAgent: AIAgentDefinition = {
  name: "TestAgent",
  model: defaultModel,
  description: "Test agent description",
  specialization: "test specialization",
  systemMessage: "Original system message",
  routerType: "simple",
};

const defaultSubAgent: AIAgentDefinition = {
  name: "SubAgent",
  model: {
    ...defaultModel,
    modelName: "gpt-3.5-turbo",
  },
  description: "Sub agent description",
  specialization: "sub specialization",
  systemMessage: "Sub agent system message",
  routerType: "simple",
};

const defaultRouterSystemMessage = "Generated router system message";

beforeEach(() => {
  mockBuildRouterSystemMessage.mockClear();
  mockBuildRouterSystemMessage.mockReturnValue(defaultRouterSystemMessage);
});

test("Unit -> buildRouterAgent returns simple router type for agent without sub-agents", () => {
  const agent = { ...defaultAgent };

  const result = buildRouterAgent(agent);

  expect(result).toEqual({
    ...agent,
    routerType: "simple",
  });
  expect(mockBuildRouterSystemMessage).not.toHaveBeenCalled();
});

test("Unit -> buildRouterAgent returns simple router type for agent with empty sub-agents array", () => {
  const agent = { ...defaultAgent, availableSubAgents: [] };

  const result = buildRouterAgent(agent);

  expect(result).toEqual({
    ...agent,
    routerType: "simple",
  });
  expect(mockBuildRouterSystemMessage).not.toHaveBeenCalled();
});

test("Unit -> buildRouterAgent builds router agent with sub-agents", () => {
  const subAgents = [defaultSubAgent];
  const agent = { ...defaultAgent, availableSubAgents: subAgents };

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
    ] as unknown[] as Tool[],
    specialization: agent.specialization,
    routerType: "router",
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
    { ...defaultSubAgent, name: "SubAgent2", description: "Second sub agent" },
    { ...defaultSubAgent, name: "SubAgent3", description: "Third sub agent" },
  ];
  const agent = { ...defaultAgent, availableSubAgents: subAgents };

  const result = buildRouterAgent(agent);

  expect(mockBuildRouterSystemMessage).toHaveBeenCalledWith(
    agent.name,
    agent.description,
    subAgents
  );

  expect(result.routerType).toBe("router");
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
