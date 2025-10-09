import { test, expect, beforeEach, mock, describe, afterAll } from "bun:test";
import { ToolMessage } from "@langchain/core/messages";
import type { DynamicTool } from "@langchain/core/tools";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";
import { cheapest } from "../Agents";

const mockInvoke = mock();
const mockSlowInvoke = mock();
const mockFailingInvoke = mock();

const mockTool = {
  name: "test-tool",
  description: "Test tool for mocking",
  func: mock(),
  invoke: mockInvoke,
} as unknown as DynamicTool;

const mockSlowTool = {
  name: "slow-tool",
  description: "Slow test tool for mocking",
  func: mock(),
  invoke: mockSlowInvoke,
} as unknown as DynamicTool;

const mockFailingTool = {
  name: "failing-tool",
  description: "Failing test tool for mocking",
  func: mock(),
  invoke: mockFailingInvoke,
} as unknown as DynamicTool;

import { executeTools } from "./executeTools";

describe("executeTools", () => {
  const defaultState = {
    messages: [],
    agent: cheapest,
    model: {} as unknown,
    tools: [mockTool],
    runId: "test-run-id",
    currentResponse: "",
    toolCalls: [{ id: "call-1", name: "test-tool", args: { input: "test" } }],
    toolResults: {},
    isComplete: false,
    metadata: { initialData: true },
    toolCallsForDB: [],
    toolResultsForDB: [],
  } as typeof ToolEnabledGraphState.State;

  const defaultToolResult = "Tool executed successfully";

  beforeEach(() => {
    mockInvoke.mockClear();
    mockSlowInvoke.mockClear();
    mockFailingInvoke.mockClear();

    mockInvoke.mockResolvedValue(defaultToolResult);
    mockSlowInvoke.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve("slow result"), 100))
    );
    mockFailingInvoke.mockRejectedValue(new Error("Tool execution failed"));
  });

  afterAll(() => {
    mock.restore();
  });

  test("Unit -> executeTools returns isComplete when no tool calls", async () => {
    const state = { ...defaultState, toolCalls: [] };

    const result = await executeTools(state);

    expect(result.isComplete).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("Unit -> executeTools returns isComplete when toolCalls is undefined", async () => {
    const state = { ...defaultState, toolCalls: undefined };

    const result = await executeTools(state);

    expect(result.isComplete).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("Unit -> executeTools executes single tool call successfully", async () => {
    const result = await executeTools(defaultState);

    expect(mockInvoke).toHaveBeenCalledWith({ input: "test" });
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toBeInstanceOf(ToolMessage);
    expect(result.messages![0].content).toBe(defaultToolResult);
    expect((result.messages![0] as ToolMessage).tool_call_id).toBe("call-1");
    expect(result.toolResults).toEqual({ "test-tool": defaultToolResult });
    expect(result.metadata?.toolsExecuted).toBe(true);
    expect(result.metadata?.toolExecutionResults).toEqual(["test-tool"]);
  });

  test("Unit -> executeTools executes multiple tool calls", async () => {
    const multiToolState = {
      ...defaultState,
      toolCalls: [
        { id: "call-1", name: "test-tool", args: { input: "test1" } },
        { id: "call-2", name: "test-tool", args: { input: "test2" } },
      ],
    } as typeof ToolEnabledGraphState.State;

    const result = await executeTools(multiToolState);

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenCalledWith({ input: "test1" });
    expect(mockInvoke).toHaveBeenCalledWith({ input: "test2" });
    expect(result.messages).toHaveLength(2);
    expect(result.toolResults).toEqual({
      "test-tool": defaultToolResult,
    });
  });

  test("Unit -> executeTools handles tool not found error", async () => {
    const state = {
      ...defaultState,
      toolCalls: [{ id: "call-1", name: "unknown-tool", args: {} }],
    } as typeof ToolEnabledGraphState.State;

    const result = await executeTools(state);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].content).toBe("Tool unknown-tool not found");
    expect(result.toolResults).toEqual({
      "unknown-tool": { error: "Tool unknown-tool not found" },
    });
    expect(result.toolResultsForDB).toHaveLength(1);
    expect(result.toolResultsForDB![0].toolName).toBe("unknown-tool");
    expect(result.toolResultsForDB![0].result).toBe(
      "Tool unknown-tool not found"
    );
  });

  test("Unit -> executeTools handles tool execution error", async () => {
    const state = {
      ...defaultState,
      tools: [mockFailingTool],
      toolCalls: [{ id: "call-1", name: "failing-tool", args: {} }],
    } as typeof ToolEnabledGraphState.State;

    const result = await executeTools(state);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0].content).toBe(
      "Error executing tool failing-tool: Error: Tool execution failed"
    );
    expect(result.toolResults).toEqual({
      "failing-tool": {
        error:
          "Error executing tool failing-tool: Error: Tool execution failed",
      },
    });
  });

  test("Unit -> executeTools handles tool call without id", async () => {
    const state = {
      ...defaultState,
      toolCalls: [{ name: "test-tool", args: { input: "test" } }],
    } as typeof ToolEnabledGraphState.State;

    const result = await executeTools(state);

    expect((result.messages![0] as ToolMessage).tool_call_id).toBe("unknown");
    expect(result.toolResultsForDB![0].toolCallId).toBeUndefined();
  });

  test("Unit -> executeTools measures execution time", async () => {
    const state = {
      ...defaultState,
      tools: [mockSlowTool],
      toolCalls: [{ id: "call-1", name: "slow-tool", args: {} }],
    } as typeof ToolEnabledGraphState.State;

    const result = await executeTools(state);

    expect(result.toolResultsForDB![0].elapsedTime).toBeGreaterThan(0.05);
    expect(result.toolResultsForDB![0].elapsedTime).toBeLessThan(1);
  });

  test("Unit -> executeTools handles object tool result", async () => {
    const objectResult = { success: true, data: "test" };
    mockInvoke.mockResolvedValue(objectResult);

    const result = await executeTools(defaultState);

    expect(result.messages![0].content).toBe(JSON.stringify(objectResult));
    expect(result.toolResults!["test-tool"]).toEqual(objectResult);
    expect(result.toolResultsForDB![0].result).toBe(
      JSON.stringify(objectResult)
    );
  });

  test("Unit -> executeTools creates proper toolResultsForDB entries", async () => {
    const result = await executeTools(defaultState);

    expect(result.toolResultsForDB).toHaveLength(1);
    const dbEntry = result.toolResultsForDB![0];
    expect(dbEntry.toolName).toBe("test-tool");
    expect(dbEntry.result).toBe(defaultToolResult);
    expect(dbEntry.toolCallId).toBe("call-1");
    expect(dbEntry.dateOccurred).toBeInstanceOf(Date);
    expect(dbEntry.elapsedTime).toBeGreaterThanOrEqual(0);
  });

  test("Unit -> executeTools preserves existing metadata", async () => {
    const result = await executeTools(defaultState);

    expect(result.metadata?.initialData).toBe(true);
    expect(result.metadata?.toolsExecuted).toBe(true);
    expect(result.metadata?.toolExecutionResults).toEqual(["test-tool"]);
  });
});
