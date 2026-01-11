import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Message } from "./client";

describe("getMessageById", () => {
  // Declare mock variables
  let mockFindUniqueOrThrow: ReturnType<typeof mock>;
  let mockDBClient: {
    message: {
      findUniqueOrThrow: ReturnType<typeof mock>;
    };
  };
  let getMessageById: typeof import("./getMessageById").getMessageById;

  // Default mock data
  const defaultMessage: Message = {
    id: "message-1",
    threadId: "thread-1",
    role: "assistant",
    tokenCount: 100,
    content: "Test message content",
    workspace: [],
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    runId: "run-1",
    routingMetadata: null,
    humanSentiment: null,
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFindUniqueOrThrow = mock();
    mockDBClient = {
      message: {
        findUniqueOrThrow: mockFindUniqueOrThrow,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./getMessageById");
    getMessageById = module.getMessageById;

    // Configure default mock behavior AFTER import
    mockFindUniqueOrThrow.mockResolvedValue(defaultMessage);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getMessageById returns message when found", async () => {
    const result = await getMessageById("message-1");

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "message-1",
      },
    });
    expect(result).toEqual(defaultMessage);
  });

  test("Unit -> getMessageById throws when message not found", async () => {
    const notFoundError = new Error("Message not found");
    mockFindUniqueOrThrow.mockRejectedValue(notFoundError);

    await expect(getMessageById("message-nonexistent")).rejects.toThrow(
      "Message not found"
    );

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "message-nonexistent",
      },
    });
  });

  test("Unit -> getMessageById returns message with humanSentiment", async () => {
    const messageWithSentiment = { ...defaultMessage, humanSentiment: true };
    mockFindUniqueOrThrow.mockResolvedValue(messageWithSentiment);

    const result = await getMessageById("message-1");

    expect(result.humanSentiment).toBe(true);
  });
});
