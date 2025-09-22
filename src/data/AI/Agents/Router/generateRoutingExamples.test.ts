import { test, expect } from "bun:test";
import type { AIAgentDefinition, RoutingExample } from "../../types";
import { generateRoutingExamples } from "./generateRoutingExamples";
import type { TrustedModel } from "../../modelList";

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
  systemMessage: "Test system message",
  routerType: "simple",
};

const defaultRoutingExample: RoutingExample = {
  userRequest: "Help me with test tasks",
  confidence: 90,
  reasoning: "Test reasoning",
};

test("Unit -> generateRoutingExamples returns fallback message for empty sub-agents array", () => {
  const result = generateRoutingExamples([]);

  expect(result).toBe(
    "- Route based on request content and agent capabilities"
  );
});

test("Unit -> generateRoutingExamples uses agent's routing examples when provided", () => {
  const routingExamples = [
    defaultRoutingExample,
    {
      ...defaultRoutingExample,
      userRequest: "Another test request",
      confidence: 85,
    },
  ];
  const agent = { ...defaultAgent, routingExamples };

  const result = generateRoutingExamples([agent]);

  expect(result).toBe(
    `- "Help me with test tasks" → TestAgent (confidence: 90)\n- "Another test request" → TestAgent (confidence: 85)`
  );
});

test("Unit -> generateRoutingExamples generates fallback example from specialization", () => {
  const agent = { ...defaultAgent };

  const result = generateRoutingExamples([agent]);

  expect(result).toBe(
    `- "Help me with test specialization" → TestAgent (confidence: 85)`
  );
});

test("Unit -> generateRoutingExamples generates fallback example from description when no specialization", () => {
  const agent = { ...defaultAgent, specialization: undefined };

  const result = generateRoutingExamples([
    agent as unknown as AIAgentDefinition,
  ]);

  expect(result).toBe(
    `- "Help me with Test agent description" → TestAgent (confidence: 85)`
  );
});

test("Unit -> generateRoutingExamples uses 'relevant requests' when no specialization or description", () => {
  const agent = {
    ...defaultAgent,
    specialization: undefined,
    description: undefined,
  };

  const result = generateRoutingExamples([
    agent as unknown as AIAgentDefinition,
  ]);

  expect(result).toBe(
    `- "Help me with relevant requests" → TestAgent (confidence: 85)`
  );
});

test("Unit -> generateRoutingExamples uses lower confidence for router agents", () => {
  const subAgent = { ...defaultAgent, name: "SubAgent" };
  const routerAgent = {
    ...defaultAgent,
    name: "RouterAgent",
    availableSubAgents: [subAgent],
  };

  const result = generateRoutingExamples([routerAgent]);

  expect(result).toBe(
    `- "Help me with test specialization" → RouterAgent (confidence: 80)`
  );
});

test("Unit -> generateRoutingExamples handles multiple agents with mixed routing examples", () => {
  const agentWithExamples = {
    ...defaultAgent,
    name: "AgentWithExamples",
    routingExamples: [defaultRoutingExample],
  };
  const agentWithoutExamples = {
    ...defaultAgent,
    name: "AgentWithoutExamples",
    specialization: "other specialization",
  };

  const result = generateRoutingExamples([
    agentWithExamples,
    agentWithoutExamples,
  ]);

  expect(result).toBe(
    `- "Help me with test tasks" → AgentWithExamples (confidence: 90)\n- "Help me with other specialization" → AgentWithoutExamples (confidence: 85)`
  );
});

test("Unit -> generateRoutingExamples handles agent with multiple routing examples", () => {
  const routingExamples = [
    { userRequest: "First request", confidence: 95 },
    { userRequest: "Second request", confidence: 88 },
    { userRequest: "Third request", confidence: 92 },
  ];
  const agent = { ...defaultAgent, routingExamples };

  const result = generateRoutingExamples([agent]);

  expect(result).toBe(
    `- "First request" → TestAgent (confidence: 95)\n- "Second request" → TestAgent (confidence: 88)\n- "Third request" → TestAgent (confidence: 92)`
  );
});

test("Unit -> generateRoutingExamples handles multiple agents with different configurations", () => {
  const leafAgent = { ...defaultAgent, name: "LeafAgent" };
  const routerAgent = {
    ...defaultAgent,
    name: "RouterAgent",
    availableSubAgents: [leafAgent],
    specialization: "router specialization",
  };
  const agentWithExamples = {
    ...defaultAgent,
    name: "ExampleAgent",
    routingExamples: [{ userRequest: "Custom request", confidence: 93 }],
  };

  const result = generateRoutingExamples([
    leafAgent,
    routerAgent,
    agentWithExamples,
  ]);

  expect(result).toBe(
    `- "Help me with test specialization" → LeafAgent (confidence: 85)\n- "Help me with router specialization" → RouterAgent (confidence: 80)\n- "Custom request" → ExampleAgent (confidence: 93)`
  );
});

test("Unit -> generateRoutingExamples handles empty routing examples array", () => {
  const agent = { ...defaultAgent, routingExamples: [] };

  const result = generateRoutingExamples([agent]);

  expect(result).toBe(
    `- "Help me with test specialization" → TestAgent (confidence: 85)`
  );
});
