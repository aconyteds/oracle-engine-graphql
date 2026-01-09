import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Thread } from "@prisma/client";

describe("updateThread", () => {
  // Declare mock variables
  let mockDBClient: {
    thread: {
      update: ReturnType<typeof mock>;
    };
  };
  let updateThread: typeof import("./updateThread").updateThread;

  // Default mock data
  const defaultThread: Thread = {
    id: "thread-1",
    title: "Original Title",
    campaignId: "campaign-1",
    userId: "user-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-03"),
    userTitleOverride: null,
    pinned: false,
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    const mockUpdate = mock();
    mockDBClient = {
      thread: {
        update: mockUpdate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./updateThread");
    updateThread = module.updateThread;

    // Configure default mock behavior AFTER import
    mockDBClient.thread.update.mockResolvedValue(defaultThread);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> updateThread updates userTitleOverride only", async () => {
    const updatedThread = {
      ...defaultThread,
      userTitleOverride: "Custom Title",
    };
    mockDBClient.thread.update.mockResolvedValue(updatedThread);

    const result = await updateThread({
      threadId: "thread-1",
      userTitleOverride: "Custom Title",
    });

    expect(mockDBClient.thread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: { userTitleOverride: "Custom Title" },
    });
    expect(result.userTitleOverride).toBe("Custom Title");
  });

  test("Unit -> updateThread updates pinned only", async () => {
    const updatedThread = { ...defaultThread, pinned: true };
    mockDBClient.thread.update.mockResolvedValue(updatedThread);

    const result = await updateThread({
      threadId: "thread-1",
      pinned: true,
    });

    expect(mockDBClient.thread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: { pinned: true },
    });
    expect(result.pinned).toBe(true);
  });

  test("Unit -> updateThread updates both title and pinned", async () => {
    const updatedThread = {
      ...defaultThread,
      userTitleOverride: "New Title",
      pinned: true,
    };
    mockDBClient.thread.update.mockResolvedValue(updatedThread);

    const result = await updateThread({
      threadId: "thread-1",
      userTitleOverride: "New Title",
      pinned: true,
    });

    expect(mockDBClient.thread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: {
        userTitleOverride: "New Title",
        pinned: true,
      },
    });
    expect(result.userTitleOverride).toBe("New Title");
    expect(result.pinned).toBe(true);
  });

  test("Unit -> updateThread handles empty string title by setting to null", async () => {
    const updatedThread = { ...defaultThread, userTitleOverride: null };
    mockDBClient.thread.update.mockResolvedValue(updatedThread);

    const result = await updateThread({
      threadId: "thread-1",
      userTitleOverride: "",
    });

    expect(mockDBClient.thread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: { userTitleOverride: null },
    });
    expect(result.userTitleOverride).toBeNull();
  });

  test("Unit -> updateThread propagates database errors", async () => {
    const testError = new Error("Database error");
    mockDBClient.thread.update.mockRejectedValue(testError);

    await expect(
      updateThread({ threadId: "thread-1", pinned: true })
    ).rejects.toThrow("Database error");
  });
});
