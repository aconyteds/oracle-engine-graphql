import { beforeEach, describe, expect, test } from "bun:test";
import type { AIAgentDefinition } from "../../types";
import { RouterType } from "../../types";

describe("buildRouterSystemMessage", () => {
  let buildRouterSystemMessage: (
    routerName: string,
    routerDescription: string,
    subAgents: AIAgentDefinition[]
  ) => string;

  beforeEach(async () => {
    const module = await import("./buildRouterSystemMessage");
    buildRouterSystemMessage = module.buildRouterSystemMessage;
  });

  // Mock model (simplified for testing)
  const mockModel = {} as AIAgentDefinition["model"];

  // Default mock data
  const defaultAgent: AIAgentDefinition = {
    name: "TestAgent",
    model: mockModel,
    description: "Test agent description",
    specialization: "test specialization",
    systemMessage: "Test system message",
    routerType: RouterType.None,
  };

  const defaultSubAgent: AIAgentDefinition = {
    name: "SubAgent",
    model: mockModel,
    description: "Sub agent description",
    specialization: "sub specialization",
    systemMessage: "Sub agent system message",
    routerType: RouterType.None,
  };

  test("Unit -> buildRouterSystemMessage includes router name and description", () => {
    const routerName = "TestRouter";
    const routerDescription = "Test router description";
    const subAgents = [defaultAgent];

    const result = buildRouterSystemMessage(
      routerName,
      routerDescription,
      subAgents
    );

    expect(result).toContain(
      `You are ${routerName}, an intelligent routing agent.`
    );
    expect(result).toContain(`DESCRIPTION: ${routerDescription}`);
  });

  test("Unit -> buildRouterSystemMessage generates complete system message with sub-agents", () => {
    const routerName = "TestRouter";
    const routerDescription = "Test router description";
    const subAgents = [defaultAgent, defaultSubAgent];

    const result = buildRouterSystemMessage(
      routerName,
      routerDescription,
      subAgents
    );

    expect(result).toContain(
      `You are ${routerName}, an intelligent routing agent.`
    );
    expect(result).toContain(`DESCRIPTION: ${routerDescription}`);
    expect(result).toContain(
      `"TestAgent" (Specialized Agent): Test agent description`
    );
    expect(result).toContain(
      `"SubAgent" (Specialized Agent): Sub agent description`
    );
    expect(result).toContain(
      `"Help me with test specialization" → TestAgent (confidence: 3)`
    );
    expect(result).toContain(
      `"Help me with sub specialization" → SubAgent (confidence: 3)`
    );
  });

  test("Unit -> buildRouterSystemMessage includes all required sections", () => {
    const routerName = "TestRouter";
    const routerDescription = "Test router description";
    const subAgents = [defaultAgent];

    const result = buildRouterSystemMessage(
      routerName,
      routerDescription,
      subAgents
    );

    // Check for all major sections
    expect(result).toContain("DESCRIPTION:");
    expect(result).toContain("AVAILABLE AGENTS:");
    expect(result).toContain("ROUTING INSTRUCTIONS:");
    expect(result).toContain("ROUTING STRATEGY:");
    expect(result).toContain("ROUTING EXAMPLES:");
    expect(result).toContain("AMBIGUOUS REQUESTS:");
    expect(result).toContain('ALWAYS use the "routeToAgent" tool');
  });

  test("Unit -> buildRouterSystemMessage includes routing instructions", () => {
    const result = buildRouterSystemMessage("Router", "Description", [
      defaultAgent,
    ]);

    const expectedInstructions = [
      "1. Analyze the user's message for primary intent and domain",
      "2. Consider conversation context and history",
      "3. Determine the most appropriate agent based on expertise",
      "4. Provide confidence score (0-5) for your decision",
      "5. Include brief reasoning for routing choice",
      "6. Always specify a fallback agent",
      "7. Consider sub-router agents for complex domain-specific requests",
    ];

    expectedInstructions.forEach((instruction) => {
      expect(result).toContain(instruction);
    });
  });

  test("Unit -> buildRouterSystemMessage includes routing strategy", () => {
    const result = buildRouterSystemMessage("Router", "Description", [
      defaultAgent,
    ]);

    const expectedStrategies = [
      "- Direct routing: Route to leaf agents for clear, specific requests",
      "- Hierarchical routing: Route to sub-router agents for complex domain requests that need further analysis",
      "- Fallback routing: Use general agents for ambiguous or out-of-scope requests",
    ];

    expectedStrategies.forEach((strategy) => {
      expect(result).toContain(strategy);
    });
  });

  test("Unit -> buildRouterSystemMessage includes ambiguous request guidance", () => {
    const result = buildRouterSystemMessage("Router", "Description", [
      defaultAgent,
    ]);

    const expectedGuidance = [
      "- If uncertain between agents, use lower confidence (2-3)",
      "- Consider routing to domain-specific sub-router for better analysis",
      "- Provide detailed reasoning for borderline cases",
      "- Default to most general available agent for unclear requests",
    ];

    expectedGuidance.forEach((guidance) => {
      expect(result).toContain(guidance);
    });
  });

  test("Unit -> buildRouterSystemMessage ends with routing tool instruction", () => {
    const result = buildRouterSystemMessage("Router", "Description", [
      defaultAgent,
    ]);

    expect(result).toEndWith(
      'ALWAYS use the "analyzeConversationContext" tool to review recent messages for context before making routing decisions.\nALWAYS use the "routeToAgent" tool to confirm your routing decision. Never respond directly to user requests - your only job is routing.'
    );
  });

  test("Unit -> buildRouterSystemMessage handles special characters in router name and description", () => {
    const routerName = "Special-Router_123";
    const routerDescription =
      "Description with: special, characters & symbols!";

    const result = buildRouterSystemMessage(routerName, routerDescription, [
      defaultAgent,
    ]);

    expect(result).toContain(
      `You are ${routerName}, an intelligent routing agent.`
    );
    expect(result).toContain(`DESCRIPTION: ${routerDescription}`);
  });

  test("Unit -> buildRouterSystemMessage handles empty sub-agents array", () => {
    const result = buildRouterSystemMessage("Router", "Description", []);

    expect(result).toContain("AVAILABLE AGENTS:\n");
    expect(result).toContain(
      "ROUTING EXAMPLES:\n- Route based on request content and agent capabilities"
    );
  });

  test("Unit -> buildRouterSystemMessage preserves formatting and structure", () => {
    const result = buildRouterSystemMessage("Router", "Description", [
      defaultAgent,
    ]);

    // Check that the message maintains proper structure with line breaks
    expect(result).toMatch(
      /You are Router, an intelligent routing agent\.\n\nDESCRIPTION:/
    );
    expect(result).toMatch(
      /AVAILABLE AGENTS:\n[\s\S]*\n\nROUTING INSTRUCTIONS:/
    );
    expect(result).toMatch(/ROUTING STRATEGY:\n[\s\S]*\n\nROUTING EXAMPLES:/);
    expect(result).toMatch(/AMBIGUOUS REQUESTS:\n[\s\S]*\n\nALWAYS use/);
  });

  test("Unit -> buildRouterSystemMessage integrates sub-agent descriptions and routing examples correctly", () => {
    const subAgentWithExamples = {
      ...defaultAgent,
      name: "ExampleAgent",
      description: "Agent with custom examples",
      routingExamples: [{ userRequest: "Custom request", confidence: 4.3 }],
    };

    const result = buildRouterSystemMessage("Router", "Description", [
      subAgentWithExamples,
    ]);

    expect(result).toContain(
      `"ExampleAgent" (Specialized Agent): Agent with custom examples`
    );
    expect(result).toContain(
      `"Custom request" → ExampleAgent (confidence: 4.3)`
    );
  });
});
