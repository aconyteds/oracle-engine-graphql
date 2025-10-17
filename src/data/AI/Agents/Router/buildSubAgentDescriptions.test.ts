import { describe, expect, test } from "bun:test";
import type { TrustedModel } from "../../modelList";
import type { AIAgentDefinition } from "../../types";
import { RouterType } from "../../types";

import { buildSubAgentDescriptions } from "./buildSubAgentDescriptions";

describe("buildSubAgentDescriptions", () => {
  const defaultModel: TrustedModel = {
    modelName: "gpt-4",
    contextWindow: 8192,
    modelProvider: "OpenAI",
  };
  // Default mock data
  const defaultAgent: AIAgentDefinition = {
    name: "TestAgent",
    model: defaultModel,
    description: "Test agent description",
    specialization: "test specialization",
    systemMessage: "Test system message",
    routerType: RouterType.Simple,
  };

  test("Unit -> buildSubAgentDescriptions returns empty string for empty sub-agents array", () => {
    const result = buildSubAgentDescriptions([]);

    expect(result).toBe("");
  });

  test("Unit -> buildSubAgentDescriptions formats single specialized agent correctly", () => {
    const agent = { ...defaultAgent };

    const result = buildSubAgentDescriptions([agent]);

    expect(result).toBe(
      `- "TestAgent" (Specialized Agent): Test agent description`
    );
  });

  test("Unit -> buildSubAgentDescriptions formats single router agent correctly", () => {
    const subAgent = { ...defaultAgent, name: "SubAgent" };
    const routerAgent = {
      ...defaultAgent,
      name: "RouterAgent",
      description: "Router agent description",
      availableSubAgents: [subAgent],
    };

    const result = buildSubAgentDescriptions([routerAgent]);

    expect(result).toBe(
      `- "RouterAgent" (Router Agent): Router agent description (Routes to 1 sub-agents)`
    );
  });

  test("Unit -> buildSubAgentDescriptions handles multiple sub-agents with mixed types", () => {
    const leafAgent1 = {
      ...defaultAgent,
      name: "LeafAgent1",
      description: "First leaf agent",
    };
    const leafAgent2 = {
      ...defaultAgent,
      name: "LeafAgent2",
      description: "Second leaf agent",
    };
    const subAgent = { ...defaultAgent, name: "SubAgent" };
    const routerAgent = {
      ...defaultAgent,
      name: "RouterAgent",
      description: "Router agent description",
      availableSubAgents: [subAgent],
    };

    const result = buildSubAgentDescriptions([
      leafAgent1,
      routerAgent,
      leafAgent2,
    ]);

    expect(result).toBe(
      `- "LeafAgent1" (Specialized Agent): First leaf agent\n- "RouterAgent" (Router Agent): Router agent description (Routes to 1 sub-agents)\n- "LeafAgent2" (Specialized Agent): Second leaf agent`
    );
  });

  test("Unit -> buildSubAgentDescriptions handles router agent with multiple sub-agents", () => {
    const subAgent1 = { ...defaultAgent, name: "SubAgent1" };
    const subAgent2 = { ...defaultAgent, name: "SubAgent2" };
    const subAgent3 = { ...defaultAgent, name: "SubAgent3" };
    const routerAgent = {
      ...defaultAgent,
      name: "RouterAgent",
      description: "Router with multiple sub-agents",
      availableSubAgents: [subAgent1, subAgent2, subAgent3],
    };

    const result = buildSubAgentDescriptions([routerAgent]);

    expect(result).toBe(
      `- "RouterAgent" (Router Agent): Router with multiple sub-agents (Routes to 3 sub-agents)`
    );
  });

  test("Unit -> buildSubAgentDescriptions handles agents with special characters in names and descriptions", () => {
    const agent = {
      ...defaultAgent,
      name: "Agent-With_Special.Characters",
      description: "Description with: special, characters & symbols!",
    };

    const result = buildSubAgentDescriptions([agent]);

    expect(result).toBe(
      `- "Agent-With_Special.Characters" (Specialized Agent): Description with: special, characters & symbols!`
    );
  });

  test("Unit -> buildSubAgentDescriptions handles empty description", () => {
    const agent = { ...defaultAgent, description: "" };

    const result = buildSubAgentDescriptions([agent]);

    expect(result).toBe(`- "TestAgent" (Specialized Agent): `);
  });

  test("Unit -> buildSubAgentDescriptions handles undefined description", () => {
    const agent = { ...defaultAgent, description: undefined };

    const result = buildSubAgentDescriptions([
      agent as unknown as AIAgentDefinition,
    ]);

    expect(result).toBe(`- "TestAgent" (Specialized Agent): undefined`);
  });

  test("Unit -> buildSubAgentDescriptions maintains order of agents", () => {
    const agent1 = {
      ...defaultAgent,
      name: "ZAgent",
      description: "Last alphabetically",
    };
    const agent2 = {
      ...defaultAgent,
      name: "AAgent",
      description: "First alphabetically",
    };
    const agent3 = {
      ...defaultAgent,
      name: "MAgent",
      description: "Middle alphabetically",
    };

    const result = buildSubAgentDescriptions([agent1, agent2, agent3]);

    expect(result).toBe(
      `- "ZAgent" (Specialized Agent): Last alphabetically\n- "AAgent" (Specialized Agent): First alphabetically\n- "MAgent" (Specialized Agent): Middle alphabetically`
    );
  });

  test("Unit -> buildSubAgentDescriptions handles nested router agents", () => {
    const leafAgent = { ...defaultAgent, name: "LeafAgent" };
    const midRouterAgent = {
      ...defaultAgent,
      name: "MidRouter",
      description: "Mid-level router",
      availableSubAgents: [leafAgent],
    };
    const topRouterAgent = {
      ...defaultAgent,
      name: "TopRouter",
      description: "Top-level router",
      availableSubAgents: [midRouterAgent, leafAgent],
    };

    const result = buildSubAgentDescriptions([topRouterAgent]);

    expect(result).toBe(
      `- "TopRouter" (Router Agent): Top-level router (Routes to 2 sub-agents)`
    );
  });
});
