import { test, expect, beforeEach, mock, describe, afterAll } from "bun:test";
import { routeToAgent } from "./routeToAgent";

describe("routeToAgent", () => {
  const mockConsoleLog = mock();
  const originalConsoleLog = console.log;

  beforeEach(() => {
    mock.restore();
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
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
    };

    const result = await routeToAgent.call(input);
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

  test("Unit -> routeToAgent uses undefined fallback when not specified", async () => {
    const input = {
      targetAgent: "Character Generator",
      confidence: 4,
      reasoning: "Character creation request",
      intentKeywords: ["npc"],
    };

    const result = await routeToAgent.call(input);
    const parsed = JSON.parse(result) as {
      fallbackAgent?: string;
    };

    expect(parsed.fallbackAgent).toBeUndefined();
  });

  test("Unit -> routeToAgent logs routing decisions", async () => {
    const input = {
      targetAgent: "Character Generator",
      confidence: 4.5,
      reasoning: "Clear character creation intent",
      intentKeywords: ["character"],
    };

    await routeToAgent.call(input);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "🎯 Routing Decision: Character Generator (4.5 confidence)"
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      "📝 Reasoning: Clear character creation intent"
    );
  });

  test("Unit -> routeToAgent handles context factors", async () => {
    const input = {
      targetAgent: "Cheapest",
      confidence: 3.5,
      reasoning: "General question with some context",
      intentKeywords: ["help"],
      contextFactors: ["previous_character_discussion", "topic_shift"],
    };

    const result = await routeToAgent.call(input);
    const parsed = JSON.parse(result) as {
      contextFactors: string[];
    };

    expect(parsed.contextFactors).toEqual([
      "previous_character_discussion",
      "topic_shift",
    ]);
  });

  test("Unit -> routeToAgent handles missing optional parameters", async () => {
    const input = {
      targetAgent: "General Assistant",
      confidence: 3.75,
      reasoning: "Basic question about math",
      intentKeywords: ["math", "calculation"],
    };

    const result = await routeToAgent.call(input);
    const parsed = JSON.parse(result) as {
      fallbackAgent?: string;
      contextFactors: string[];
    };

    expect(parsed.fallbackAgent).toBeUndefined();
    expect(parsed.contextFactors).toEqual([]);
  });
});
