import { test, expect, beforeEach } from "bun:test";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { validateToolInput } from "./validateToolInput";

const defaultTool = { name: "test-tool", description: "Test tool" };

const defaultState = {
  messages: [
    new HumanMessage("Test message"),
    new SystemMessage("System message"),
  ],
  tools: [defaultTool, { name: "tool2", description: "Another tool" }],
  metadata: { existingData: true },
} as typeof ToolEnabledGraphState.State;

beforeEach(() => {
  // No mocks to clear for this simple validation function
});

test("Unit -> validateToolInput validates state with messages and tools", async () => {
  const result = await validateToolInput(defaultState);

  expect(result.metadata?.validated).toBe(true);
  expect(result.metadata?.messageCount).toBe(2);
  expect(result.metadata?.toolsAvailable).toBe(2);
  expect(result.metadata?.toolNames).toEqual(["test-tool", "tool2"]);
  expect(result.metadata?.existingData).toBe(true);
});

test("Unit -> validateToolInput throws error when no messages provided", () => {
  const state = { ...defaultState, messages: [] };

  expect(() => validateToolInput(state)).toThrow(
    "No messages provided for generation"
  );
});

test("Unit -> validateToolInput throws error when messages is undefined", () => {
  const state = {
    ...defaultState,
    messages: undefined as unknown as HumanMessage[],
  };

  expect(() => validateToolInput(state)).toThrow(
    "No messages provided for generation"
  );
});

test("Unit -> validateToolInput handles empty tools array", async () => {
  const state = { ...defaultState, tools: [] };

  const result = await validateToolInput(state);

  expect(result.metadata?.validated).toBe(true);
  expect(result.metadata?.toolsAvailable).toBe(0);
  expect(result.metadata?.toolNames).toEqual([]);
});

test("Unit -> validateToolInput handles single message", async () => {
  const state = {
    ...defaultState,
    messages: [new HumanMessage("Single message")],
  };

  const result = await validateToolInput(state);

  expect(result.metadata?.messageCount).toBe(1);
  expect(result.metadata?.validated).toBe(true);
});

test("Unit -> validateToolInput preserves existing metadata", async () => {
  const state = {
    ...defaultState,
    metadata: { customField: "value", count: 42 },
  };

  const result = await validateToolInput(state);

  expect(result.metadata?.customField).toBe("value");
  expect(result.metadata?.count).toBe(42);
  expect(result.metadata?.validated).toBe(true);
});

test("Unit -> validateToolInput handles undefined metadata", async () => {
  const state = { ...defaultState, metadata: undefined };

  const result = await validateToolInput(state);

  expect(result.metadata?.validated).toBe(true);
  expect(result.metadata?.messageCount).toBe(2);
  expect(result.metadata?.toolsAvailable).toBe(2);
});

test("Unit -> validateToolInput extracts correct tool names", async () => {
  const complexTools = [
    { name: "calculator", description: "Math tool" },
    { name: "weather", description: "Weather tool" },
    { name: "search", description: "Search tool" },
  ];
  const state = { ...defaultState, tools: complexTools };

  const result = await validateToolInput(state);

  expect(result.metadata?.toolNames).toEqual([
    "calculator",
    "weather",
    "search",
  ]);
  expect(result.metadata?.toolsAvailable).toBe(3);
});
