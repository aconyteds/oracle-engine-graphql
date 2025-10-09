import { test, expect, beforeEach, describe, afterEach, mock } from "bun:test";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

describe("validateToolInput", () => {
  let validateToolInput: (
    state: typeof ToolEnabledGraphState.State
  ) => Promise<Partial<typeof ToolEnabledGraphState.State>>;

  beforeEach(async () => {
    mock.restore();

    const module = await import("./validateToolInput");
    validateToolInput = module.validateToolInput;
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> validateToolInput validates state with messages and tools", async () => {
    const defaultTool = { name: "test-tool", description: "Test tool" };

    const defaultState = {
      messages: [
        new HumanMessage("Test message"),
        new SystemMessage("System message"),
      ],
      tools: [defaultTool, { name: "tool2", description: "Another tool" }],
      metadata: { existingData: true },
    } as typeof ToolEnabledGraphState.State;

    const result = await validateToolInput(defaultState);

    expect(result.metadata?.validated).toBe(true);
    expect(result.metadata?.messageCount).toBe(2);
    expect(result.metadata?.toolsAvailable).toBe(2);
    expect(result.metadata?.toolNames).toEqual(["test-tool", "tool2"]);
    expect(result.metadata?.existingData).toBe(true);
  });

  test("Unit -> validateToolInput throws error when no messages provided", () => {
    const defaultTool = { name: "test-tool", description: "Test tool" };

    const state = {
      messages: [],
      tools: [defaultTool],
      metadata: { existingData: true },
    } as typeof ToolEnabledGraphState.State;

    expect(() => validateToolInput(state)).toThrow(
      "No messages provided for generation"
    );
  });

  test("Unit -> validateToolInput throws error when messages is undefined", () => {
    const defaultTool = { name: "test-tool", description: "Test tool" };

    const state = {
      messages: undefined as unknown as never[],
      tools: [defaultTool],
      metadata: { existingData: true },
    } as typeof ToolEnabledGraphState.State;

    expect(() => validateToolInput(state)).toThrow(
      "No messages provided for generation"
    );
  });

  test("Unit -> validateToolInput handles empty tools array", async () => {
    const state = {
      messages: [
        new HumanMessage("Test message"),
        new SystemMessage("System message"),
      ],
      tools: [],
      metadata: { existingData: true },
    } as typeof ToolEnabledGraphState.State;

    const result = await validateToolInput(state);

    expect(result.metadata?.validated).toBe(true);
    expect(result.metadata?.toolsAvailable).toBe(0);
    expect(result.metadata?.toolNames).toEqual([]);
  });

  test("Unit -> validateToolInput handles single message", async () => {
    const defaultTool = { name: "test-tool", description: "Test tool" };

    const state = {
      messages: [new HumanMessage("Single message")],
      tools: [defaultTool],
      metadata: { existingData: true },
    } as typeof ToolEnabledGraphState.State;

    const result = await validateToolInput(state);

    expect(result.metadata?.messageCount).toBe(1);
    expect(result.metadata?.validated).toBe(true);
  });

  test("Unit -> validateToolInput preserves existing metadata", async () => {
    const defaultTool = { name: "test-tool", description: "Test tool" };

    const state = {
      messages: [
        new HumanMessage("Test message"),
        new SystemMessage("System message"),
      ],
      tools: [defaultTool],
      metadata: { customField: "value", count: 42 },
    } as typeof ToolEnabledGraphState.State;

    const result = await validateToolInput(state);

    expect(result.metadata?.customField).toBe("value");
    expect(result.metadata?.count).toBe(42);
    expect(result.metadata?.validated).toBe(true);
  });

  test("Unit -> validateToolInput handles undefined metadata", async () => {
    const defaultTool = { name: "test-tool", description: "Test tool" };

    const state = {
      messages: [
        new HumanMessage("Test message"),
        new SystemMessage("System message"),
      ],
      tools: [defaultTool, { name: "tool2", description: "Another tool" }],
      metadata: undefined,
    } as typeof ToolEnabledGraphState.State;

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
    const state = {
      messages: [
        new HumanMessage("Test message"),
        new SystemMessage("System message"),
      ],
      tools: complexTools,
      metadata: { existingData: true },
    } as typeof ToolEnabledGraphState.State;

    const result = await validateToolInput(state);

    expect(result.metadata?.toolNames).toEqual([
      "calculator",
      "weather",
      "search",
    ]);
    expect(result.metadata?.toolsAvailable).toBe(3);
  });
});
