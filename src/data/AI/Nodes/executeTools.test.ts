import { test, expect, beforeEach, mock } from "bun:test";
import { ToolMessage } from "@langchain/core/messages";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

const mockTool = {
  name: "test-tool",
  invoke: mock(),
};

const mockSlowTool = {
  name: "slow-tool",
  invoke: mock(),
};

const mockFailingTool = {
  name: "failing-tool",
  invoke: mock(),
};

import { executeTools } from "./executeTools";

const defaultState = {
  toolCalls: [{ id: "call-1", name: "test-tool", args: { input: "test" } }],
  tools: [mockTool],
  metadata: { initialData: true },
} as typeof ToolEnabledGraphState.State;

const defaultToolResult = "Tool executed successfully";

beforeEach(() => {
  mockTool.invoke.mockClear();
  mockSlowTool.invoke.mockClear();
  mockFailingTool.invoke.mockClear();

  mockTool.invoke.mockResolvedValue(defaultToolResult);
  mockSlowTool.invoke.mockImplementation(
    () =>
      new Promise((resolve) => setTimeout(() => resolve("slow result"), 100))
  );
  mockFailingTool.invoke.mockRejectedValue(new Error("Tool execution failed"));
});

test("Unit -> executeTools returns isComplete when no tool calls", async () => {
  const state = { ...defaultState, toolCalls: [] };

  const result = await executeTools(state);

  expect(result.isComplete).toBe(true);
  expect(mockTool.invoke).not.toHaveBeenCalled();
});

test("Unit -> executeTools returns isComplete when toolCalls is undefined", async () => {
  const state = { ...defaultState, toolCalls: undefined };

  const result = await executeTools(state);

  expect(result.isComplete).toBe(true);
  expect(mockTool.invoke).not.toHaveBeenCalled();
});

test("Unit -> executeTools executes single tool call successfully", async () => {
  const result = await executeTools(defaultState);

  expect(mockTool.invoke).toHaveBeenCalledWith({ input: "test" });
  expect(result.messages).toHaveLength(1);
  expect(result.messages![0]).toBeInstanceOf(ToolMessage);
  expect(result.messages![0].content).toBe(defaultToolResult);
  expect(result.messages![0].tool_call_id).toBe("call-1");
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
  };

  const result = await executeTools(multiToolState);

  expect(mockTool.invoke).toHaveBeenCalledTimes(2);
  expect(mockTool.invoke).toHaveBeenCalledWith({ input: "test1" });
  expect(mockTool.invoke).toHaveBeenCalledWith({ input: "test2" });
  expect(result.messages).toHaveLength(2);
  expect(result.toolResults).toEqual({
    "test-tool": defaultToolResult,
  });
});

test("Unit -> executeTools handles tool not found error", async () => {
  const state = {
    ...defaultState,
    toolCalls: [{ id: "call-1", name: "unknown-tool", args: {} }],
  };

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
  };

  const result = await executeTools(state);

  expect(result.messages).toHaveLength(1);
  expect(result.messages![0].content).toBe(
    "Error executing tool failing-tool: Error: Tool execution failed"
  );
  expect(result.toolResults).toEqual({
    "failing-tool": {
      error: "Error executing tool failing-tool: Error: Tool execution failed",
    },
  });
});

test("Unit -> executeTools handles tool call without id", async () => {
  const state = {
    ...defaultState,
    toolCalls: [{ name: "test-tool", args: { input: "test" } }],
  };

  const result = await executeTools(state);

  expect(result.messages![0].tool_call_id).toBe("unknown");
  expect(result.toolResultsForDB![0].toolCallId).toBeUndefined();
});

test("Unit -> executeTools measures execution time", async () => {
  const state = {
    ...defaultState,
    tools: [mockSlowTool],
    toolCalls: [{ id: "call-1", name: "slow-tool", args: {} }],
  };

  const result = await executeTools(state);

  expect(result.toolResultsForDB![0].elapsedTime).toBeGreaterThan(0.05);
  expect(result.toolResultsForDB![0].elapsedTime).toBeLessThan(1);
});

test("Unit -> executeTools handles object tool result", async () => {
  const objectResult = { success: true, data: "test" };
  mockTool.invoke.mockResolvedValue(objectResult);

  const result = await executeTools(defaultState);

  expect(result.messages![0].content).toBe(JSON.stringify(objectResult));
  expect(result.toolResults!["test-tool"]).toEqual(objectResult);
  expect(result.toolResultsForDB![0].result).toBe(JSON.stringify(objectResult));
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
