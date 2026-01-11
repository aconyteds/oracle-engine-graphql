import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { SendLangSmithFeedbackParams } from "./sendFeedback";

describe("sendLangSmithFeedback", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockCreateFeedback: ReturnType<typeof mock>;
  let mockLangSmithClient: {
    createFeedback: ReturnType<typeof mock>;
  };
  let sendLangSmithFeedback: typeof import("./sendFeedback").sendLangSmithFeedback;

  // Default mock data
  const defaultParams: SendLangSmithFeedbackParams = {
    runId: "run-uuid-123",
    humanSentiment: true,
    comments: "Great response!",
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCreateFeedback = mock();
    mockLangSmithClient = {
      createFeedback: mockCreateFeedback,
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      LangSmithClient: mockLangSmithClient,
    }));

    // Dynamically import the module under test
    const module = await import("./sendFeedback");
    sendLangSmithFeedback = module.sendLangSmithFeedback;

    // Configure default mock behavior - successful promise
    mockCreateFeedback.mockResolvedValue({
      id: "feedback-id",
      run_id: "run-uuid-123",
      key: "user_sentiment",
      score: 1,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> sendLangSmithFeedback calls createFeedback with correct parameters for positive sentiment", () => {
    sendLangSmithFeedback(defaultParams);

    expect(mockCreateFeedback).toHaveBeenCalledWith(
      "run-uuid-123",
      "user_sentiment",
      {
        score: 1,
        comment: "Great response!",
        feedbackSourceType: "app",
      }
    );
  });

  test("Unit -> sendLangSmithFeedback calls createFeedback with score 0 for negative sentiment", () => {
    const negativeParams = { ...defaultParams, humanSentiment: false };

    sendLangSmithFeedback(negativeParams);

    expect(mockCreateFeedback).toHaveBeenCalledWith(
      "run-uuid-123",
      "user_sentiment",
      {
        score: 0,
        comment: "Great response!",
        feedbackSourceType: "app",
      }
    );
  });

  test("Unit -> sendLangSmithFeedback handles undefined comments", () => {
    const noCommentsParams: SendLangSmithFeedbackParams = {
      runId: "run-123",
      humanSentiment: true,
    };

    sendLangSmithFeedback(noCommentsParams);

    expect(mockCreateFeedback).toHaveBeenCalledWith(
      "run-123",
      "user_sentiment",
      {
        score: 1,
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

  test("Unit -> sendLangSmithFeedback uses user_sentiment as feedback key", () => {
    sendLangSmithFeedback(defaultParams);

    // Verify second argument is the feedback key
    expect(mockCreateFeedback.mock.calls[0][1]).toBe("user_sentiment");
  });

  test("Unit -> sendLangSmithFeedback passes runId as first argument", () => {
    const customRunId = "custom-run-id-456";
    const params = { ...defaultParams, runId: customRunId };

    sendLangSmithFeedback(params);

    // Verify first argument is the runId
    expect(mockCreateFeedback.mock.calls[0][0]).toBe(customRunId);
  });

  test("Unit -> sendLangSmithFeedback includes feedbackSourceType as app", () => {
    sendLangSmithFeedback(defaultParams);

    const feedbackOptions = mockCreateFeedback.mock.calls[0][2];
    expect(feedbackOptions.feedbackSourceType).toBe("app");
  });
});
