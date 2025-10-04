import { test, expect, beforeEach, mock, describe, afterEach } from "bun:test";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

describe("generateFinalResponse", () => {
  // Mock dependencies - recreated for each test
  let mockInvoke: ReturnType<typeof mock>;
  let HumanMessage: any;
  let AIMessage: any;
  let ToolMessage: any;
  let generateFinalResponse: typeof import("./generateFinalResponse").generateFinalResponse;

  beforeEach(async () => {
    // Restore all mocks before each test
    mock.restore();

    // Create fresh mock
    mockInvoke = mock();

    const mockModel = {
      invoke: mockInvoke,
    };

    // Set up module mocks
    mock.module("@langchain/core/messages", () => ({
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
            this.content = contentOrConfig;
            this.tool_call_id = "mock-tool-call-id";
          } else {
            this.content = contentOrConfig.content;
            this.tool_call_id = contentOrConfig.tool_call_id;
          }
        }
      },
    }));

    // Import the module under test after mocks are set up
    const messagesModule = await import("@langchain/core/messages");
    HumanMessage = messagesModule.HumanMessage;
    AIMessage = messagesModule.AIMessage;
    ToolMessage = messagesModule.ToolMessage;

    const module = await import("./generateFinalResponse");
    generateFinalResponse = module.generateFinalResponse;

    // Configure default mock behavior
    const defaultResponse = new AIMessage("Final response content");
    mockInvoke.mockResolvedValue(defaultResponse);
  });

  afterEach(() => {
    // Restore mocks after each test for complete isolation
    mock.restore();
  });

  test("Unit -> generateFinalResponse generates final response successfully", async () => {
    const defaultMessages = [
      new HumanMessage("User question"),
      new AIMessage("AI response with tool calls"),
      new ToolMessage("Tool result"),
    ];

    const defaultState = {
      messages: defaultMessages,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    const defaultResponse = new AIMessage("Final response content");
    mockInvoke.mockResolvedValue(defaultResponse);

    const result = await generateFinalResponse(defaultState);

    expect(mockInvoke).toHaveBeenCalledWith(defaultMessages, {
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
    const state = {
      messages: [],
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    expect(generateFinalResponse(state)).rejects.toThrow(
      "No messages available for final response generation"
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("Unit -> generateFinalResponse passes runId to model", async () => {
    const defaultMessages = [
      new HumanMessage("User question"),
      new AIMessage("AI response with tool calls"),
      new ToolMessage("Tool result"),
    ];

    const customRunId = "custom-run-789";
    const state = {
      messages: defaultMessages,
      model: { invoke: mockInvoke },
      runId: customRunId,
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    await generateFinalResponse(state);

    expect(mockInvoke).toHaveBeenCalledWith(defaultMessages, {
      runId: customRunId,
    });
  });

  test("Unit -> generateFinalResponse handles model error", () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const defaultMessages = [
      new HumanMessage("User question"),
      new AIMessage("AI response with tool calls"),
      new ToolMessage("Tool result"),
    ];

    const state = {
      messages: defaultMessages,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    const testError = new Error("Model invocation failed");
    mockInvoke.mockRejectedValue(testError);

    try {
      expect(generateFinalResponse(state)).rejects.toThrow(
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
    const defaultMessages = [
      new HumanMessage("User question"),
      new AIMessage("AI response with tool calls"),
      new ToolMessage("Tool result"),
    ];

    const customMetadata = {
      toolsExecuted: true,
      customField: "value",
      count: 42,
    };
    const state = {
      messages: defaultMessages,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: customMetadata,
    } as unknown as typeof ToolEnabledGraphState.State;

    const result = await generateFinalResponse(state);

    expect(result.metadata?.toolsExecuted).toBe(true);
    expect(result.metadata?.customField).toBe("value");
    expect(result.metadata?.count).toBe(42);
    expect(result.metadata?.finalResponseGenerated).toBe(true);
  });

  test("Unit -> generateFinalResponse handles undefined metadata", async () => {
    const defaultMessages = [
      new HumanMessage("User question"),
      new AIMessage("AI response with tool calls"),
      new ToolMessage("Tool result"),
    ];

    const state = {
      messages: defaultMessages,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: undefined,
    } as unknown as typeof ToolEnabledGraphState.State;

    const result = await generateFinalResponse(state);

    expect(result.metadata?.finalResponseGenerated).toBe(true);
  });

  test("Unit -> generateFinalResponse works with single message", async () => {
    const singleMessage = [new HumanMessage("Single question")];
    const state = {
      messages: singleMessage,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    const result = await generateFinalResponse(state);

    expect(mockInvoke).toHaveBeenCalledWith(singleMessage, {
      runId: "test-run-456",
    });
    expect(result.isComplete).toBe(true);
  });

  test("Unit -> generateFinalResponse extracts string content correctly", async () => {
    const defaultMessages = [
      new HumanMessage("User question"),
      new AIMessage("AI response with tool calls"),
      new ToolMessage("Tool result"),
    ];

    const state = {
      messages: defaultMessages,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    const responseContent = "This is the final response";
    const response = new AIMessage(responseContent);
    mockInvoke.mockResolvedValue(response);

    const result = await generateFinalResponse(state);

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
    const state = {
      messages: complexMessages,
      model: { invoke: mockInvoke },
      runId: "test-run-456",
      metadata: { toolsExecuted: true },
    } as unknown as typeof ToolEnabledGraphState.State;

    await generateFinalResponse(state);

    expect(mockInvoke).toHaveBeenCalledWith(complexMessages, {
      runId: "test-run-456",
    });
  });
});
