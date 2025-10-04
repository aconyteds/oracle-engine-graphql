import { test, expect, beforeEach, mock, describe, afterAll } from "bun:test";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";
import type { AIAgentDefinition } from "../types";

const mockModel = {
  bindTools: mock(),
  invoke: mock(),
};

const mockAgent = {
  name: "test-agent",
  systemMessage: "You are a helpful assistant",
  model: "gpt-3.5-turbo",
} as unknown as AIAgentDefinition;

const mockTool = {
  name: "test-tool",
  description: "Test tool",
};

const mockModelWithTools = {
  invoke: mock(),
};

void mock.module("@langchain/core/messages", () => ({
  SystemMessage: class MockSystemMessage {
    constructor(public content: string) {}
    id = "SystemMessage_1";
  },
  HumanMessage: class MockHumanMessage {
    constructor(public content: string) {}
    id = "HumanMessage_1";
  },
  AIMessage: class MockAIMessage {
    constructor(public content: string) {}
    id = "AIMessage_1";
  },
}));

import { generateWithTools } from "./generateWithTools";

describe("generateWithTools", () => {
  const defaultMessages = [new HumanMessage("Test message")];

  const defaultState = {
    messages: defaultMessages,
    tools: [mockTool],
    runId: "test-run-123",
    metadata: { initialData: true },
    agent: mockAgent,
    model: mockModel,
  } as unknown as typeof ToolEnabledGraphState.State;

  const defaultResponse = new AIMessage("Test response");

  beforeEach(() => {
    mockModel.bindTools.mockClear();
    mockModel.invoke.mockClear();
    mockModelWithTools.invoke.mockClear();

    mockModel.bindTools.mockReturnValue(mockModelWithTools);
    mockModelWithTools.invoke.mockResolvedValue(defaultResponse);
    mockModel.invoke.mockResolvedValue(defaultResponse);
  });

  afterAll(() => {
    mock.restore();
  });

  test("Unit -> generateWithTools generates response without tool calls", async () => {
    const response = { ...defaultResponse, tool_calls: undefined };
    mockModelWithTools.invoke.mockResolvedValue(response);

    const result = await generateWithTools(defaultState);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toBe(response);
    expect(result.currentResponse).toBe(defaultResponse.content);
    expect(result.isComplete).toBe(true);
    expect(result.metadata?.responseGenerated).toBe(true);
    expect(result.metadata?.hasToolCalls).toBe(false);
  });

  test("Unit -> generateWithTools generates response with tool calls", async () => {
    const toolCalls = [
      { id: "call-1", name: "test-tool", args: { input: "test" } },
    ];
    const responseWithTools = {
      ...defaultResponse,
      tool_calls: toolCalls,
    };
    mockModelWithTools.invoke.mockResolvedValue(responseWithTools);

    const result = await generateWithTools(defaultState);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toBe(responseWithTools);
    expect(result.toolCalls).toEqual(toolCalls);
    expect(result.toolCallsForDB).toHaveLength(1);
    expect(result.toolCallsForDB![0].toolName).toBe("test-tool");
    expect(result.toolCallsForDB![0].arguments).toBe(
      JSON.stringify({ input: "test" })
    );
    expect(result.toolCallsForDB![0].toolCallId).toBe("call-1");
    expect(result.metadata?.hasToolCalls).toBe(true);
    expect(result.metadata?.toolCallCount).toBe(1);
  });

  test("Unit -> generateWithTools binds tools when available", async () => {
    await generateWithTools(defaultState);

    expect(mockModel.bindTools).toHaveBeenCalledWith([mockTool]);
    expect(mockModelWithTools.invoke).toHaveBeenCalled();
  });

  test("Unit -> generateWithTools uses model directly when no tools", async () => {
    const stateWithoutTools = { ...defaultState, tools: [] };

    await generateWithTools(stateWithoutTools);

    expect(mockModel.bindTools).not.toHaveBeenCalled();
    expect(mockModel.invoke).toHaveBeenCalled();
  });

  test("Unit -> generateWithTools includes system message first", async () => {
    await generateWithTools(defaultState);

    const invokeCall = mockModelWithTools.invoke.mock.calls[0] as unknown[];
    const messagesUsed = invokeCall[0] as SystemMessage[];

    expect(messagesUsed[0]).toBeInstanceOf(SystemMessage);
    expect(messagesUsed[0].content).toBe("You are a helpful assistant");
  });

  test("Unit -> generateWithTools filters out existing system messages", async () => {
    const messagesWithSystem = [
      new SystemMessage("Old system message"),
      new HumanMessage("User message"),
    ];
    const state = { ...defaultState, messages: messagesWithSystem };

    await generateWithTools(state);

    const invokeCall = mockModelWithTools.invoke.mock.calls[0] as unknown[];
    const messagesUsed = invokeCall[0] as SystemMessage[];

    expect(messagesUsed).toHaveLength(2);
    expect(messagesUsed[0].content).toBe("You are a helpful assistant");
    expect(messagesUsed[1].content).toBe("User message");
  });

  test("Unit -> generateWithTools passes runId to model invoke", async () => {
    await generateWithTools(defaultState);

    const invokeCall = mockModelWithTools.invoke.mock.calls[0] as unknown[];
    const options = invokeCall[1] as { runId: string };

    expect(options.runId).toBe("test-run-123");
  });

  test("Unit -> generateWithTools handles multiple tool calls", async () => {
    const toolCalls = [
      { id: "call-1", name: "tool1", args: { input: "test1" } },
      { id: "call-2", name: "tool2", args: { input: "test2" } },
    ];
    const responseWithMultipleTools = {
      ...defaultResponse,
      tool_calls: toolCalls,
    };
    mockModelWithTools.invoke.mockResolvedValue(responseWithMultipleTools);

    const result = await generateWithTools(defaultState);

    expect(result.toolCallsForDB).toHaveLength(2);
    expect(result.metadata?.toolCallCount).toBe(2);
  });

  test("Unit -> generateWithTools handles error during generation", () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Model generation failed");
    mockModelWithTools.invoke.mockRejectedValue(testError);

    try {
      expect(generateWithTools(defaultState)).rejects.toThrow(
        "Model generation failed"
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error generating response with tools:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> generateWithTools preserves existing metadata", async () => {
    const result = await generateWithTools(defaultState);

    expect(result.metadata?.initialData).toBe(true);
    expect(result.metadata?.responseGenerated).toBe(true);
  });

  test("Unit -> generateWithTools creates toolCallsForDB with proper timestamps", async () => {
    const toolCalls = [
      { id: "call-1", name: "test-tool", args: { input: "test" } },
    ];
    const responseWithTools = { ...defaultResponse, tool_calls: toolCalls };
    mockModelWithTools.invoke.mockResolvedValue(responseWithTools);

    const result = await generateWithTools(defaultState);

    expect(result.toolCallsForDB![0].dateOccurred).toBeInstanceOf(Date);
  });
});
