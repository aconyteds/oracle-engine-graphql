import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { SendLangSmithFeedbackParams } from "./sendFeedback";

describe("sendLangSmithFeedback", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockCreateFeedback: ReturnType<typeof mock>;
  let mockGetTraceId: ReturnType<typeof mock>;
  let mockLangSmithClient: {
    createFeedback: ReturnType<typeof mock>;
  };
  let sendLangSmithFeedback: typeof import("./sendFeedback").sendLangSmithFeedback;

  // Default mock data
  const defaultMessageId = "msg-123";
  const defaultTraceId = "trace-789";
  const defaultParams: SendLangSmithFeedbackParams = {
    messageId: defaultMessageId,
    humanSentiment: true,
    comments: "Great response!",
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCreateFeedback = mock();
    mockGetTraceId = mock();
    mockLangSmithClient = {
      createFeedback: mockCreateFeedback,
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      LangSmithClient: mockLangSmithClient,
    }));

    mock.module("./getTraceId", () => ({
      getTraceId: mockGetTraceId,
    }));

    // Dynamically import the module under test
    const module = await import("./sendFeedback");
    sendLangSmithFeedback = module.sendLangSmithFeedback;

    // Configure default mock behavior
    mockGetTraceId.mockResolvedValue(defaultTraceId);
    mockCreateFeedback.mockResolvedValue({
      id: "feedback-id",
      run_id: defaultTraceId,
      key: "user_sentiment",
      score: 1,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> sendLangSmithFeedback calls createFeedback with correct parameters for positive sentiment", async () => {
    sendLangSmithFeedback(defaultParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockGetTraceId).toHaveBeenCalledWith(defaultMessageId);
    expect(mockCreateFeedback).toHaveBeenCalledWith(
      defaultTraceId,
      "user_sentiment",
      {
        score: 1,
        value: "Positive",
        comment: "Great response!",
        feedbackSourceType: "app",
      }
    );
  });

  test("Unit -> sendLangSmithFeedback calls createFeedback with score 0 for negative sentiment", async () => {
    const negativeParams = { ...defaultParams, humanSentiment: false };

    sendLangSmithFeedback(negativeParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockCreateFeedback).toHaveBeenCalledWith(
      defaultTraceId,
      "user_sentiment",
      {
        score: 0,
        value: "Negative",
        comment: "Great response!",
        feedbackSourceType: "app",
      }
    );
  });

  test("Unit -> sendLangSmithFeedback handles undefined comments", async () => {
    const noCommentsParams: SendLangSmithFeedbackParams = {
      messageId: defaultMessageId,
      humanSentiment: true,
    };

    sendLangSmithFeedback(noCommentsParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockCreateFeedback).toHaveBeenCalledWith(
      defaultTraceId,
      "user_sentiment",
      {
        score: 1,
        value: "Positive",
        comment: undefined,
        feedbackSourceType: "app",
      }
    );
  });

  test("Unit -> sendLangSmithFeedback returns void immediately (fire-and-forget)", () => {
    const result = sendLangSmithFeedback(defaultParams);

    // Should return undefined (void function)
    expect(result).toBeUndefined();
  });

  test("Unit -> sendLangSmithFeedback handles API errors silently", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const testError = new Error("Run not found in LangSmith");
    mockCreateFeedback.mockRejectedValue(testError);

    try {
      // Call the function - should not throw
      sendLangSmithFeedback(defaultParams);

      // Wait for the async catch block to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify error was logged
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "LangSmith feedback submission failed:",
        testError
      );
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> sendLangSmithFeedback handles network errors silently", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const networkError = new Error("Network request failed");
    mockCreateFeedback.mockRejectedValue(networkError);

    try {
      sendLangSmithFeedback(defaultParams);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "LangSmith feedback submission failed:",
        networkError
      );
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> sendLangSmithFeedback uses user_sentiment as feedback key", async () => {
    sendLangSmithFeedback(defaultParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify second argument is the feedback key
    expect(mockCreateFeedback.mock.calls[0][1]).toBe("user_sentiment");
  });

  test("Unit -> sendLangSmithFeedback passes trace ID as first argument", async () => {
    const customTraceId = "custom-trace-id-456";
    mockGetTraceId.mockResolvedValue(customTraceId);

    sendLangSmithFeedback(defaultParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify first argument is the trace ID
    expect(mockCreateFeedback.mock.calls[0][0]).toBe(customTraceId);
  });

  test("Unit -> sendLangSmithFeedback includes feedbackSourceType as app", async () => {
    sendLangSmithFeedback(defaultParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    const feedbackOptions = mockCreateFeedback.mock.calls[0][2];
    expect(feedbackOptions.feedbackSourceType).toBe("app");
  });

  test("Unit -> sendLangSmithFeedback does not call createFeedback when trace ID is null", async () => {
    mockGetTraceId.mockResolvedValue(null);

    sendLangSmithFeedback(defaultParams);

    // Wait for the async promise chain to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockGetTraceId).toHaveBeenCalledWith(defaultMessageId);
    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });

  test("Unit -> sendLangSmithFeedback handles getTraceId errors silently", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const testError = new Error("Failed to fetch trace ID");
    mockGetTraceId.mockRejectedValue(testError);

    try {
      sendLangSmithFeedback(defaultParams);

      // Wait for the async catch block to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify error was logged
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "Failed to retrieve trace ID for LangSmith feedback:",
        testError
      );
      // Should not call createFeedback
      expect(mockCreateFeedback).not.toHaveBeenCalled();
    } finally {
      console.warn = originalConsoleWarn;
    }
  });
});
