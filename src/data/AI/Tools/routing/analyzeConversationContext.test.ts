import { test, expect, beforeEach } from "bun:test";
import { analyzeConversationContext } from "./analyzeConversationContext";

beforeEach(() => {
  // No mocks to clear for this simple tool
});

test("Unit -> analyzeConversationContext returns valid analysis structure with default messageCount", async () => {
  const input = {};

  const result = await analyzeConversationContext.call(input);
  const parsed = JSON.parse(result) as {
    analysisType: string;
    messageCount: number;
    patterns: unknown[];
    topicShifts: unknown[];
    agentPerformance: Record<string, unknown>;
    recommendations: unknown[];
  };

  expect(parsed.analysisType).toBe("conversation_context");
  expect(parsed.messageCount).toBe(5);
  expect(parsed.patterns).toEqual([]);
  expect(parsed.topicShifts).toEqual([]);
  expect(parsed.agentPerformance).toEqual({});
  expect(parsed.recommendations).toEqual([]);
});

test("Unit -> analyzeConversationContext uses provided messageCount", async () => {
  const input = { messageCount: 3 };

  const result = await analyzeConversationContext.call(input);
  const parsed = JSON.parse(result) as {
    messageCount: number;
  };

  expect(parsed.messageCount).toBe(3);
});

test("Unit -> analyzeConversationContext handles maximum messageCount", async () => {
  const input = { messageCount: 10 };

  const result = await analyzeConversationContext.call(input);
  const parsed = JSON.parse(result) as {
    messageCount: number;
  };

  expect(parsed.messageCount).toBe(10);
});

test("Unit -> analyzeConversationContext handles minimum messageCount", async () => {
  const input = { messageCount: 1 };

  const result = await analyzeConversationContext.call(input);
  const parsed = JSON.parse(result) as {
    messageCount: number;
  };

  expect(parsed.messageCount).toBe(1);
});

test("Unit -> analyzeConversationContext throws error for messageCount below minimum", async () => {
  const input = { messageCount: 0 };

  await expect(analyzeConversationContext.call(input)).rejects.toThrow(
    "Received tool input did not match expected schema"
  );
});

test("Unit -> analyzeConversationContext throws error for messageCount above maximum", async () => {
  const input = { messageCount: 11 };

  await expect(analyzeConversationContext.call(input)).rejects.toThrow(
    "Received tool input did not match expected schema"
  );
});

test("Unit -> analyzeConversationContext throws error for negative messageCount", async () => {
  const input = { messageCount: -1 };

  await expect(analyzeConversationContext.call(input)).rejects.toThrow(
    "Received tool input did not match expected schema"
  );
});

test("Unit -> analyzeConversationContext accepts non-integer messageCount within range", async () => {
  const input = { messageCount: 3.5 };

  const result = await analyzeConversationContext.call(input);
  const parsed = JSON.parse(result) as {
    messageCount: number;
  };

  expect(parsed.messageCount).toBe(3.5);
});

test("Unit -> analyzeConversationContext returns properly formatted JSON", async () => {
  const input = { messageCount: 7 };

  const result = await analyzeConversationContext.call(input);

  // Verify it's valid JSON
  expect(() => {
    JSON.parse(result);
    return true;
  }).not.toThrow();

  // Verify it's formatted (has indentation)
  expect(result).toContain("\n");
  expect(result).toContain("  ");
});

test("Unit -> analyzeConversationContext has correct tool schema properties", () => {
  expect(analyzeConversationContext.name).toBe("analyzeConversationContext");
  expect(analyzeConversationContext.description).toBe(
    "Analyze recent conversation history for context clues that influence routing"
  );
  expect(analyzeConversationContext.schema).toBeDefined();
});

test("Unit -> analyzeConversationContext validates input through schema", async () => {
  // This should work because messageCount is optional
  const validInput = {};
  await expect(
    analyzeConversationContext.call(validInput)
  ).resolves.toBeDefined();

  // This should work because messageCount is within range
  const validInputWithCount = { messageCount: 5 };
  await expect(
    analyzeConversationContext.call(validInputWithCount)
  ).resolves.toBeDefined();
});

test("Unit -> analyzeConversationContext includes all expected fields in response", async () => {
  const input = { messageCount: 4 };

  const result = await analyzeConversationContext.call(input);
  const parsed = JSON.parse(result) as Record<string, unknown>;

  expect(parsed).toHaveProperty("analysisType");
  expect(parsed).toHaveProperty("messageCount");
  expect(parsed).toHaveProperty("patterns");
  expect(parsed).toHaveProperty("topicShifts");
  expect(parsed).toHaveProperty("agentPerformance");
  expect(parsed).toHaveProperty("recommendations");
});

test("Unit -> analyzeConversationContext handles edge case with messageCount as string number", async () => {
  // This tests the runtime validation since schema might coerce types
  const input = { messageCount: "5" as unknown as number };

  await expect(analyzeConversationContext.call(input)).rejects.toThrow(
    "Received tool input did not match expected schema"
  );
});
