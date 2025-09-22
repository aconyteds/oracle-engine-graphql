import { test, expect, beforeEach, mock } from "bun:test";
import { routeToAgent } from "./routeToAgent";

const mockConsoleLog = mock();
console.log = mockConsoleLog;

beforeEach(() => {
  mockConsoleLog.mockClear();
});

test("Unit -> routeToAgent returns valid routing decision structure", async () => {
  const input = {
    targetAgent: "Character Generator",
    confidence: 95,
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
  expect(parsed.confidence).toBe(95);
  expect(parsed.fallbackAgent).toBe("Cheapest");
  expect(parsed.intentKeywords).toEqual(["character", "create", "wizard"]);
  expect(parsed.timestamp).toBeDefined();
});

test("Unit -> routeToAgent uses undefined fallback when not specified", async () => {
  const input = {
    targetAgent: "Character Generator",
    confidence: 80,
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
    confidence: 90,
    reasoning: "Clear character creation intent",
    intentKeywords: ["character"],
  };

  await routeToAgent.call(input);

  expect(mockConsoleLog).toHaveBeenCalledWith(
    "🎯 Routing Decision: Character Generator (90% confidence)"
  );
  expect(mockConsoleLog).toHaveBeenCalledWith(
    "📝 Reasoning: Clear character creation intent"
  );
});

test("Unit -> routeToAgent handles context factors", async () => {
  const input = {
    targetAgent: "Cheapest",
    confidence: 70,
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
    confidence: 75,
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
