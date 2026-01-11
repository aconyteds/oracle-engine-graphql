import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { GraphQLError } from "graphql";
import type { Message } from "../../../data/MongoDB";

describe("captureHumanFeedback", () => {
  // Declare mock variables
  let mockGetMessageById: ReturnType<typeof mock>;
  let mockUpdateMessageFeedback: ReturnType<typeof mock>;
  let mockVerifyThreadOwnership: ReturnType<typeof mock>;
  let mockInvalidInput: ReturnType<typeof mock>;
  let mockServerError: ReturnType<typeof mock>;
  let mockSendLangSmithFeedback: ReturnType<typeof mock>;
  let captureHumanFeedback: typeof import("./captureHumanFeedback").captureHumanFeedback;

  // Default mock data
  const defaultMessage: Message = {
    id: "message-1",
    threadId: "thread-1",
    role: "assistant",
    tokenCount: 100,
    content: "This is a test message",
    workspace: [],
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    runId: "run-1",
    routingMetadata: null,
    humanSentiment: null,
    feedbackComments: null,
  };

  const defaultInput = {
    messageId: "message-1",
    humanSentiment: true,
    userId: "user-1",
    campaignId: "campaign-1",
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockGetMessageById = mock();
    mockUpdateMessageFeedback = mock();
    mockVerifyThreadOwnership = mock();
    mockInvalidInput = mock();
    mockServerError = mock();
    mockSendLangSmithFeedback = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      getMessageById: mockGetMessageById,
      updateMessageFeedback: mockUpdateMessageFeedback,
      verifyThreadOwnership: mockVerifyThreadOwnership,
    }));

    mock.module("../../../graphql/errors", () => ({
      InvalidInput: mockInvalidInput,
      ServerError: mockServerError,
    }));

    mock.module("../../../data/LangSmith", () => ({
      sendLangSmithFeedback: mockSendLangSmithFeedback,
    }));

    // Dynamically import the module under test
    const module = await import("./captureHumanFeedback");
    captureHumanFeedback = module.captureHumanFeedback;

    // Configure default mock behavior AFTER import
    mockGetMessageById.mockResolvedValue(defaultMessage);
    mockUpdateMessageFeedback.mockResolvedValue({
      ...defaultMessage,
      humanSentiment: true,
    });
    mockVerifyThreadOwnership.mockResolvedValue(true);
    mockInvalidInput.mockImplementation((msg: string) => new GraphQLError(msg));
    mockServerError.mockImplementation((msg: string) => new GraphQLError(msg));
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> captureHumanFeedback returns success message when feedback is submitted", async () => {
    const result = await captureHumanFeedback(defaultInput);

    expect(mockGetMessageById).toHaveBeenCalledWith("message-1");
    expect(mockVerifyThreadOwnership).toHaveBeenCalledWith(
      "thread-1",
      "user-1",
      "campaign-1"
    );
    expect(mockUpdateMessageFeedback).toHaveBeenCalledWith({
      messageId: "message-1",
      humanSentiment: true,
    });
    expect(result).toBe("Thank you for providing feedback!");
  });

  test("Unit -> captureHumanFeedback handles negative sentiment", async () => {
    const input = { ...defaultInput, humanSentiment: false };

    const result = await captureHumanFeedback(input);

    expect(mockUpdateMessageFeedback).toHaveBeenCalledWith({
      messageId: "message-1",
      humanSentiment: false,
    });
    expect(result).toBe("Thank you for providing feedback!");
  });

  test("Unit -> captureHumanFeedback throws error when feedback already submitted", async () => {
    const messageWithFeedback = { ...defaultMessage, humanSentiment: true };
    mockGetMessageById.mockResolvedValue(messageWithFeedback);

    await expect(captureHumanFeedback(defaultInput)).rejects.toThrow(
      "You have already submitted feedback for this message."
    );

    expect(mockInvalidInput).toHaveBeenCalledWith(
      "You have already submitted feedback for this message."
    );
    expect(mockUpdateMessageFeedback).not.toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback throws error when feedback is false (already submitted)", async () => {
    const messageWithFeedback = { ...defaultMessage, humanSentiment: false };
    mockGetMessageById.mockResolvedValue(messageWithFeedback);

    await expect(captureHumanFeedback(defaultInput)).rejects.toThrow(
      "You have already submitted feedback for this message."
    );

    expect(mockInvalidInput).toHaveBeenCalledWith(
      "You have already submitted feedback for this message."
    );
    expect(mockUpdateMessageFeedback).not.toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback verifies thread ownership before updating", async () => {
    await captureHumanFeedback(defaultInput);

    expect(mockVerifyThreadOwnership).toHaveBeenCalledWith(
      "thread-1",
      "user-1",
      "campaign-1"
    );
    expect(mockUpdateMessageFeedback).toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback throws error when user does not own thread", async () => {
    const authError = new GraphQLError(
      "You are not authorized to view this resource."
    );
    mockVerifyThreadOwnership.mockRejectedValue(authError);

    await expect(captureHumanFeedback(defaultInput)).rejects.toThrow(
      "You are not authorized to view this resource."
    );

    expect(mockUpdateMessageFeedback).not.toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback logs and throws server error on database error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const dbError = new Error("Database connection failed");
    mockUpdateMessageFeedback.mockRejectedValue(dbError);

    try {
      await expect(captureHumanFeedback(defaultInput)).rejects.toThrow(
        "Failed to capture feedback"
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error capturing human feedback:",
        dbError
      );
      expect(mockServerError).toHaveBeenCalledWith(
        "Failed to capture feedback",
        expect.any(String)
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> captureHumanFeedback handles message not found error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const notFoundError = new Error("Message not found");
    mockGetMessageById.mockRejectedValue(notFoundError);

    try {
      await expect(captureHumanFeedback(defaultInput)).rejects.toThrow(
        "Failed to capture feedback"
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error capturing human feedback:",
        notFoundError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> captureHumanFeedback uses message threadId for ownership verification", async () => {
    const customMessage = { ...defaultMessage, threadId: "thread-custom" };
    mockGetMessageById.mockResolvedValue(customMessage);

    await captureHumanFeedback(defaultInput);

    expect(mockVerifyThreadOwnership).toHaveBeenCalledWith(
      "thread-custom",
      "user-1",
      "campaign-1"
    );
  });

  test("Unit -> captureHumanFeedback accepts undefined humanSentiment in message", async () => {
    const messageWithNull = {
      ...defaultMessage,
      humanSentiment: null,
    };
    mockGetMessageById.mockResolvedValue(messageWithNull);

    const result = await captureHumanFeedback(defaultInput);

    expect(mockUpdateMessageFeedback).toHaveBeenCalled();
    expect(result).toBe("Thank you for providing feedback!");
  });

  test("Unit -> captureHumanFeedback sends feedback to LangSmith when runId exists", async () => {
    const messageWithRunId = { ...defaultMessage, runId: "run-123" };
    mockGetMessageById.mockResolvedValue(messageWithRunId);

    await captureHumanFeedback(defaultInput);

    expect(mockSendLangSmithFeedback).toHaveBeenCalledWith({
      runId: "run-123",
      humanSentiment: true,
      comments: undefined,
    });
  });

  test("Unit -> captureHumanFeedback does not send feedback to LangSmith when runId is null", async () => {
    const messageWithoutRunId = { ...defaultMessage, runId: null };
    mockGetMessageById.mockResolvedValue(messageWithoutRunId);

    await captureHumanFeedback(defaultInput);

    expect(mockSendLangSmithFeedback).not.toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback passes comments to LangSmith feedback", async () => {
    const messageWithRunId = { ...defaultMessage, runId: "run-123" };
    mockGetMessageById.mockResolvedValue(messageWithRunId);
    const inputWithComments = { ...defaultInput, comments: "Very helpful!" };

    await captureHumanFeedback(inputWithComments);

    expect(mockSendLangSmithFeedback).toHaveBeenCalledWith({
      runId: "run-123",
      humanSentiment: true,
      comments: "Very helpful!",
    });
  });

  test("Unit -> captureHumanFeedback sends negative sentiment to LangSmith", async () => {
    const messageWithRunId = { ...defaultMessage, runId: "run-123" };
    mockGetMessageById.mockResolvedValue(messageWithRunId);
    const inputWithNegative = { ...defaultInput, humanSentiment: false };

    await captureHumanFeedback(inputWithNegative);

    expect(mockSendLangSmithFeedback).toHaveBeenCalledWith({
      runId: "run-123",
      humanSentiment: false,
      comments: undefined,
    });
  });

  test("Unit -> captureHumanFeedback sends LangSmith feedback after MongoDB update", async () => {
    const messageWithRunId = { ...defaultMessage, runId: "run-123" };
    mockGetMessageById.mockResolvedValue(messageWithRunId);

    await captureHumanFeedback(defaultInput);

    // Verify order: MongoDB update called before LangSmith
    expect(mockUpdateMessageFeedback).toHaveBeenCalled();
    expect(mockSendLangSmithFeedback).toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback does not send LangSmith feedback when feedback already exists", async () => {
    const messageWithFeedback = {
      ...defaultMessage,
      runId: "run-123",
      humanSentiment: true,
    };
    mockGetMessageById.mockResolvedValue(messageWithFeedback);

    await expect(captureHumanFeedback(defaultInput)).rejects.toThrow();

    expect(mockSendLangSmithFeedback).not.toHaveBeenCalled();
  });

  test("Unit -> captureHumanFeedback passes comments to updateMessageFeedback", async () => {
    const inputWithComments = { ...defaultInput, comments: "Very helpful!" };

    await captureHumanFeedback(inputWithComments);

    expect(mockUpdateMessageFeedback).toHaveBeenCalledWith({
      messageId: "message-1",
      humanSentiment: true,
      comments: "Very helpful!",
    });
  });

  test("Unit -> captureHumanFeedback calls updateMessageFeedback without comments when undefined", async () => {
    await captureHumanFeedback(defaultInput);

    expect(mockUpdateMessageFeedback).toHaveBeenCalledWith({
      messageId: "message-1",
      humanSentiment: true,
    });
  });

  test("Unit -> captureHumanFeedback passes both negative sentiment and comments to MongoDB", async () => {
    const inputWithNegativeAndComments = {
      ...defaultInput,
      humanSentiment: false,
      comments: "Incorrect information provided",
    };

    await captureHumanFeedback(inputWithNegativeAndComments);

    expect(mockUpdateMessageFeedback).toHaveBeenCalledWith({
      messageId: "message-1",
      humanSentiment: false,
      comments: "Incorrect information provided",
    });
  });
});
