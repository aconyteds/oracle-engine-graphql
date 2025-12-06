import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Thread } from "./client";

describe("createThread", () => {
  // Declare mock variables
  let mockCreateTitle: ReturnType<typeof mock>;
  let mockCreate: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      create: ReturnType<typeof mock>;
    };
  };
  let createThread: typeof import("./createThread").createThread;

  // Default mock data
  const defaultThread: Thread = {
    id: "thread-1",
    title: "Test Thread Title",
    campaignId: "campaign-1",
    userId: "owner-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultInput = {
    message: "Hello, this is a test message",
    campaignId: "campaign-1",
    userId: "owner-1",
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCreateTitle = mock();
    mockCreate = mock();
    mockDBClient = {
      thread: {
        create: mockCreate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../AI", () => ({
      createTitle: mockCreateTitle,
    }));

    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./createThread");
    createThread = module.createThread;

    // Configure default mock behavior AFTER import
    mockCreateTitle.mockResolvedValue("Test Thread Title");
    mockCreate.mockResolvedValue(defaultThread);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> createThread creates a thread with campaignId", async () => {
    const result = await createThread(defaultInput);

    expect(mockCreateTitle).toHaveBeenCalledWith(defaultInput.message);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        title: "Test Thread Title",
        campaignId: "campaign-1",
        userId: "owner-1",
      },
    });
    expect(result).toBe("thread-1");
  });

  test("Unit -> createThread generates title from message", async () => {
    const customInput = {
      ...defaultInput,
      message: "Custom message for title generation",
    };

    await createThread(customInput);

    expect(mockCreateTitle).toHaveBeenCalledWith(
      "Custom message for title generation"
    );
  });

  test("Unit -> createThread returns the created thread ID", async () => {
    const customThread = { ...defaultThread, id: "thread-custom-123" };
    mockCreate.mockResolvedValue(customThread);

    const result = await createThread(defaultInput);

    expect(result).toBe("thread-custom-123");
  });

  test("Unit -> createThread uses provided campaignId", async () => {
    const customInput = {
      ...defaultInput,
      campaignId: "campaign-different",
    };

    await createThread(customInput);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        title: "Test Thread Title",
        campaignId: "campaign-different",
        userId: "owner-1",
      },
    });
  });

  test("Unit -> createThread handles errors from createTitle", async () => {
    const testError = new Error("Title generation failed");
    mockCreateTitle.mockRejectedValue(testError);

    await expect(createThread(defaultInput)).rejects.toThrow(
      "Title generation failed"
    );

    expect(mockCreateTitle).toHaveBeenCalledWith(defaultInput.message);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("Unit -> createThread handles errors from database", async () => {
    const testError = new Error("Database error");
    mockCreate.mockRejectedValue(testError);

    await expect(createThread(defaultInput)).rejects.toThrow("Database error");

    expect(mockCreateTitle).toHaveBeenCalledWith(defaultInput.message);
    expect(mockCreate).toHaveBeenCalled();
  });
});
