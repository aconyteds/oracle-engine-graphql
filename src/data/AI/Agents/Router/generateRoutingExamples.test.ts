import { describe, expect, test } from "bun:test";
import { ChatOpenAI } from "@langchain/openai";
import type { AIAgentDefinition, RoutingExample } from "../../types";
import { RouterType } from "../../types";
import { generateRoutingExamples } from "./generateRoutingExamples";

describe("generateRoutingExamples", () => {
  const defaultModel = new ChatOpenAI({
    model: "gpt-5-nano",
  });

  // Default mock data
  const defaultAgent: AIAgentDefinition = {
    name: "TestAgent",
    model: defaultModel,
    description: "Test agent description",
    specialization: "test specialization",
    systemMessage: "Test system message",
    routerType: RouterType.None,
  };

  const defaultRoutingExample: RoutingExample = {
    userRequest: "Help me with test tasks",
    confidence: 4.5,
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
        confidence: 4.25,
      },
    ];
    const agent = { ...defaultAgent, routingExamples };

    const result = generateRoutingExamples([agent]);

    expect(result).toBe(
      `- "Help me with test tasks" → TestAgent (confidence: 4.5)\n- "Another test request" → TestAgent (confidence: 4.25)`
    );
  });

  test("Unit -> generateRoutingExamples generates fallback example from specialization", () => {
    const agent = { ...defaultAgent };

    const result = generateRoutingExamples([agent]);

    expect(result).toBe(
      `- "Help me with test specialization" → TestAgent (confidence: 3)`
    );
  });

  test("Unit -> generateRoutingExamples generates fallback example from description when no specialization", () => {
    const agent = { ...defaultAgent, specialization: undefined };

    const result = generateRoutingExamples([
      agent as unknown as AIAgentDefinition,
    ]);

    expect(result).toBe(
      `- "Help me with Test agent description" → TestAgent (confidence: 3)`
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
      `- "Help me with relevant requests" → TestAgent (confidence: 3)`
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
      `- "Help me with test specialization" → RouterAgent (confidence: 2)`
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
      `- "Help me with test tasks" → AgentWithExamples (confidence: 4.5)\n- "Help me with other specialization" → AgentWithoutExamples (confidence: 3)`
    );
  });

  test("Unit -> generateRoutingExamples handles agent with multiple routing examples", () => {
    const routingExamples = [
      { userRequest: "First request", confidence: 4.5 },
      { userRequest: "Second request", confidence: 4.25 },
      { userRequest: "Third request", confidence: 4.3 },
    ];
    const agent = { ...defaultAgent, routingExamples };

    const result = generateRoutingExamples([agent]);

    expect(result).toBe(
      `- "First request" → TestAgent (confidence: 4.5)\n- "Second request" → TestAgent (confidence: 4.25)\n- "Third request" → TestAgent (confidence: 4.3)`
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
      routingExamples: [{ userRequest: "Custom request", confidence: 4.5 }],
    };

    const result = generateRoutingExamples([
      leafAgent,
      routerAgent,
      agentWithExamples,
    ]);

    expect(result).toBe(
      `- "Help me with test specialization" → LeafAgent (confidence: 3)\n- "Help me with router specialization" → RouterAgent (confidence: 2)\n- "Custom request" → ExampleAgent (confidence: 4.5)`
    );
  });

  test("Unit -> generateRoutingExamples handles empty routing examples array", () => {
    const agent = { ...defaultAgent, routingExamples: [] };

    const result = generateRoutingExamples([agent]);

    expect(result).toBe(
      `- "Help me with test specialization" → TestAgent (confidence: 3)`
    );
  });
});
