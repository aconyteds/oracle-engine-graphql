import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { RequestContext } from "../../types";
import { routeToAgent } from "./routeToAgent";

describe("routeToAgent", () => {
  const mockConsoleLog = mock();
  const originalConsoleLog = console.log;
  let mockYieldMessage: ReturnType<typeof mock>;

  const defaultRequestContext: RequestContext = {
    userId: "user-1",
    campaignId: "campaign-1",
    threadId: "thread-1",
    runId: "run-1",
    yieldMessage: mock(),
  };

  beforeEach(() => {
    mock.restore();
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
    mockYieldMessage = mock();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    mock.restore();
  });

  test("Unit -> routeToAgent returns valid routing decision structure", async () => {
    const input = {
      targetAgent: "Character Generator",
      confidence: 4.75,
      reasoning:
        "User requested character creation with specific class and level",
      fallbackAgent: "Cheapest",
      intentKeywords: ["character", "create", "wizard"],
      contextFactors: [],
    };

    const config = {
      context: {
        ...defaultRequestContext,
        yieldMessage: mockYieldMessage,
      },
    };

    const result = await routeToAgent.invoke(input, config);
    const parsed = JSON.parse(result) as {
      type: string;
      targetAgent: string;
      confidence: number;
      fallbackAgent: string;
      intentKeywords: string[];
      timestamp: string;
    };

    expect(parsed.type).toBe("routing_decision");
    expect(parsed.targetAgent).toBe("Character Generator");
    expect(parsed.confidence).toBe(4.75);
    expect(parsed.fallbackAgent).toBe("Cheapest");
    expect(parsed.intentKeywords).toEqual(["character", "create", "wizard"]);
    expect(parsed.timestamp).toBeDefined();
  });

  test("Unit -> routeToAgent requires fallbackAgent field", async () => {
    const input = {
      targetAgent: "Character Generator",
      confidence: 4,
      reasoning: "Character creation request",
      intentKeywords: ["npc"],
      fallbackAgent: "Cheapest",
      contextFactors: [],
    };

    const config = {
      context: {
        ...defaultRequestContext,
        yieldMessage: mockYieldMessage,
      },
    };

    const result = await routeToAgent.invoke(input, config);
    const parsed = JSON.parse(result) as {
      fallbackAgent: string;
    };

    expect(parsed.fallbackAgent).toBe("Cheapest");
  });

  test("Unit -> routeToAgent returns routing decision without errors", async () => {
    const input = {
      targetAgent: "Character Generator",
      confidence: 4.5,
      reasoning: "Clear character creation intent",
      intentKeywords: ["character"],
      fallbackAgent: "Cheapest",
      contextFactors: [],
    };

    const config = {
      context: {
        ...defaultRequestContext,
        yieldMessage: mockYieldMessage,
      },
    };

    const result = await routeToAgent.invoke(input, config);
    const parsed = JSON.parse(result) as {
      targetAgent: string;
      confidence: number;
    };

    expect(parsed.targetAgent).toBe("Character Generator");
    expect(parsed.confidence).toBe(4.5);
  });

  test("Unit -> routeToAgent handles context factors", async () => {
    const input = {
      targetAgent: "Cheapest",
      confidence: 3.5,
      reasoning: "General question with some context",
      intentKeywords: ["help"],
      fallbackAgent: "default",
      contextFactors: ["previous_character_discussion", "topic_shift"],
    };

    const config = {
      context: {
        ...defaultRequestContext,
        yieldMessage: mockYieldMessage,
      },
    };

    const result = await routeToAgent.invoke(input, config);
    const parsed = JSON.parse(result) as {
      contextFactors: string[];
    };

    expect(parsed.contextFactors).toEqual([
      "previous_character_discussion",
      "topic_shift",
    ]);
  });

  test("Unit -> routeToAgent handles empty context factors", async () => {
    const input = {
      targetAgent: "General Assistant",
      confidence: 3.75,
      reasoning: "Basic question about math",
      intentKeywords: ["math", "calculation"],
      fallbackAgent: "Cheapest",
      contextFactors: [],
    };

    const config = {
      context: {
        ...defaultRequestContext,
        yieldMessage: mockYieldMessage,
      },
    };

    const result = await routeToAgent.invoke(input, config);
    const parsed = JSON.parse(result) as {
      fallbackAgent: string;
      contextFactors: string[];
    };

    expect(parsed.fallbackAgent).toBe("Cheapest");
    expect(parsed.contextFactors).toEqual([]);
  });
});
