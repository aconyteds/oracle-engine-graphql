import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Message } from "./client";

describe("updateMessageFeedback", () => {
  // Declare mock variables
  let mockUpdate: ReturnType<typeof mock>;
  let mockDBClient: {
    message: {
      update: ReturnType<typeof mock>;
    };
  };
  let updateMessageFeedback: typeof import("./updateMessageFeedback").updateMessageFeedback;

  // Default mock data
  const defaultMessage: Message = {
    id: "message-1",
    threadId: "thread-1",
    role: "assistant",
    tokenCount: 100,
    content: "Test message content",
    workspace: [],
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
    runId: "run-1",
    routingMetadata: null,
    humanSentiment: true,
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockUpdate = mock();
    mockDBClient = {
      message: {
        update: mockUpdate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./updateMessageFeedback");
    updateMessageFeedback = module.updateMessageFeedback;

    // Configure default mock behavior AFTER import
    mockUpdate.mockResolvedValue(defaultMessage);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> updateMessageFeedback updates message with positive sentiment", async () => {
    const result = await updateMessageFeedback({
      messageId: "message-1",
      humanSentiment: true,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "message-1",
      },
      data: {
        humanSentiment: true,
      },
    });
    expect(result).toEqual(defaultMessage);
  });

  test("Unit -> updateMessageFeedback updates message with negative sentiment", async () => {
    const messageWithNegative = { ...defaultMessage, humanSentiment: false };
    mockUpdate.mockResolvedValue(messageWithNegative);

    const result = await updateMessageFeedback({
      messageId: "message-1",
      humanSentiment: false,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "message-1",
      },
      data: {
        humanSentiment: false,
      },
    });
    expect(result.humanSentiment).toBe(false);
  });

  test("Unit -> updateMessageFeedback throws when message not found", async () => {
    const notFoundError = new Error("Message not found");
    mockUpdate.mockRejectedValue(notFoundError);

    await expect(
      updateMessageFeedback({
        messageId: "message-nonexistent",
        humanSentiment: true,
      })
    ).rejects.toThrow("Message not found");

    expect(mockUpdate).toHaveBeenCalled();
  });

  test("Unit -> updateMessageFeedback returns updated message", async () => {
    const result = await updateMessageFeedback({
      messageId: "message-1",
      humanSentiment: true,
    });

    expect(result.id).toBe("message-1");
    expect(result.humanSentiment).toBe(true);
  });
});
