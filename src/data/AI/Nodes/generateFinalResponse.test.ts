import { test, expect, beforeEach, mock, describe, afterEach } from "bun:test";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { ToolEnabledGraphState } from "../Workflows/toolEnabledWorkflow";

describe("generateFinalResponse", () => {
  // Mock dependencies - recreated for each test
  let mockInvoke: ReturnType<typeof mock>;
  let generateFinalResponse: (
    state: typeof ToolEnabledGraphState.State
  ) => Promise<Partial<typeof ToolEnabledGraphState.State>>;

  beforeEach(async () => {
    // Restore all mocks before each test
    mock.restore();

    // Create fresh mock
    mockInvoke = mock();

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
      new ToolMessage(
        {
          content: "Tool result content",
        },
        "test-tool-result-id"
      ),
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
    expect(result.currentResponse).toBe("Final response content");
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
      new ToolMessage(
        {
          content: "Tool result content",
        },
        "test-tool-result-id"
      ),
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
      new ToolMessage(
        {
          content: "Tool result content",
        },
        "test-tool-result-id"
      ),
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
      new ToolMessage(
        {
          content: "Tool result content",
        },
        "test-tool-result-id"
      ),
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
      new ToolMessage(
        {
          content: "Tool result content",
        },
        "test-tool-result-id"
      ),
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
      new ToolMessage(
        {
          content: "Tool result content",
        },
        "test-tool-result-id"
      ),
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
      new ToolMessage(
        {
          content: "Calculator result: 42",
        },
        "test-tool-result-id"
      ),
      new AIMessage("Tool interpretation"),
      new ToolMessage(
        {
          content: "Weather result content",
        },
        "test-tool-result-id-2"
      ),
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
