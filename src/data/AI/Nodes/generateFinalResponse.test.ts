import { test, expect, beforeEach, mock } from "bun:test";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

const mockModel = {
  invoke: mock(),
};

void mock.module("@langchain/core/messages", () => ({
  HumanMessage: class MockHumanMessage {
    constructor(public content: string) {}
    id = "HumanMessage_1";
  },
  AIMessage: class MockAIMessage {
    constructor(public content: string) {}
    id = "AIMessage_1";
  },
  ToolMessage: class MockToolMessage {
    public content: string;
    public tool_call_id: string;
    id = "ToolMessage_1";

    constructor(
      contentOrConfig: string | { content: string; tool_call_id: string }
    ) {
      if (typeof contentOrConfig === "string") {
        // Legacy constructor for this test
        this.content = contentOrConfig;
        this.tool_call_id = "mock-tool-call-id";
      } else {
        // New object-based constructor
        this.content = contentOrConfig.content;
        this.tool_call_id = contentOrConfig.tool_call_id;
      }
    }
  },
}));

import { generateFinalResponse } from "./generateFinalResponse";

const defaultMessages = [
  new HumanMessage("User question"),
  new AIMessage("AI response with tool calls"),
  new ToolMessage("Tool result"),
];

const defaultState = {
  messages: defaultMessages,
  model: mockModel,
  runId: "test-run-456",
  metadata: { toolsExecuted: true },
} as typeof ToolEnabledGraphState.State;

const defaultResponse = new AIMessage("Final response content");

beforeEach(() => {
  mockModel.invoke.mockClear();
  mockModel.invoke.mockResolvedValue(defaultResponse);
});

test("Unit -> generateFinalResponse generates final response successfully", async () => {
  const result = await generateFinalResponse(defaultState);

  expect(mockModel.invoke).toHaveBeenCalledWith(defaultMessages, {
    runId: "test-run-456",
  });
  expect(result.messages).toHaveLength(1);
  expect(result.messages![0]).toBe(defaultResponse);
  expect(result.currentResponse).toBe(defaultResponse.content);
  expect(result.isComplete).toBe(true);
  expect(result.metadata?.finalResponseGenerated).toBe(true);
  expect(result.metadata?.toolsExecuted).toBe(true);
});

test("Unit -> generateFinalResponse throws error when no messages", () => {
  const state = { ...defaultState, messages: [] };

  expect(generateFinalResponse(state)).rejects.toThrow(
    "No messages available for final response generation"
  );
  expect(mockModel.invoke).not.toHaveBeenCalled();
});

test("Unit -> generateFinalResponse passes runId to model", async () => {
  const customRunId = "custom-run-789";
  const state = { ...defaultState, runId: customRunId };

  await generateFinalResponse(state);

  expect(mockModel.invoke).toHaveBeenCalledWith(defaultMessages, {
    runId: customRunId,
  });
});

test("Unit -> generateFinalResponse handles model error", () => {
  const originalConsoleError = console.error;
  const mockConsoleError = mock();
  console.error = mockConsoleError;

  const testError = new Error("Model invocation failed");
  mockModel.invoke.mockRejectedValue(testError);

  try {
    expect(generateFinalResponse(defaultState)).rejects.toThrow(
      "Model invocation failed"
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Error generating final response:",
      testError
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("Unit -> generateFinalResponse preserves existing metadata", async () => {
  const customMetadata = {
    toolsExecuted: true,
    customField: "value",
    count: 42,
  };
  const state = { ...defaultState, metadata: customMetadata };

  const result = await generateFinalResponse(state);

  expect(result.metadata?.toolsExecuted).toBe(true);
  expect(result.metadata?.customField).toBe("value");
  expect(result.metadata?.count).toBe(42);
  expect(result.metadata?.finalResponseGenerated).toBe(true);
});

test("Unit -> generateFinalResponse handles undefined metadata", async () => {
  const state = { ...defaultState, metadata: undefined };

  const result = await generateFinalResponse(state);

  expect(result.metadata?.finalResponseGenerated).toBe(true);
});

test("Unit -> generateFinalResponse works with single message", async () => {
  const singleMessage = [new HumanMessage("Single question")];
  const state = { ...defaultState, messages: singleMessage };

  const result = await generateFinalResponse(state);

  expect(mockModel.invoke).toHaveBeenCalledWith(singleMessage, {
    runId: "test-run-456",
  });
  expect(result.isComplete).toBe(true);
});

test("Unit -> generateFinalResponse extracts string content correctly", async () => {
  const responseContent = "This is the final response";
  const response = new AIMessage(responseContent);
  mockModel.invoke.mockResolvedValue(response);

  const result = await generateFinalResponse(defaultState);

  expect(result.currentResponse).toBe(responseContent);
});

test("Unit -> generateFinalResponse handles complex message chain", async () => {
  const complexMessages = [
    new HumanMessage("User question"),
    new AIMessage("AI response with tool call"),
    new ToolMessage("Calculator result: 42"),
    new AIMessage("Tool interpretation"),
    new ToolMessage("Weather result: sunny"),
  ];
  const state = { ...defaultState, messages: complexMessages };

  await generateFinalResponse(state);

  expect(mockModel.invoke).toHaveBeenCalledWith(complexMessages, {
    runId: "test-run-456",
  });
});
