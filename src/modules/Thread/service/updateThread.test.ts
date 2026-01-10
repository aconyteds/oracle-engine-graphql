import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Thread } from "../../../data/MongoDB";

describe("updateThread service", () => {
  // Declare mock variables
  let mockUpdateThreadInDB: ReturnType<typeof mock>;
  let updateThread: typeof import("./updateThread").updateThread;

  // Default mock data
  const defaultThread: Thread = {
    id: "thread-1",
    title: "Original Title",
    campaignId: "campaign-1",
    userId: "user-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-03"),
    userTitleOverride: "Custom Title",
    pinned: true,
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockUpdateThreadInDB = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      updateThread: mockUpdateThreadInDB,
    }));

    // Dynamically import the module under test
    const module = await import("./updateThread");
    updateThread = module.updateThread;

    // Configure default mock behavior AFTER import
    mockUpdateThreadInDB.mockResolvedValue(defaultThread);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> updateThread maps title to userTitleOverride", async () => {
    const result = await updateThread({
      threadId: "thread-1",
      title: "New Title",
    });

    expect(mockUpdateThreadInDB).toHaveBeenCalledWith({
      threadId: "thread-1",
      userTitleOverride: "New Title",
      pinned: undefined,
    });
    expect(result).toEqual(defaultThread);
  });

  test("Unit -> updateThread maps isPinned to pinned", async () => {
    const result = await updateThread({
      threadId: "thread-1",
      isPinned: true,
    });

    expect(mockUpdateThreadInDB).toHaveBeenCalledWith({
      threadId: "thread-1",
      userTitleOverride: undefined,
      pinned: true,
    });
    expect(result).toEqual(defaultThread);
  });

  test("Unit -> updateThread maps both fields", async () => {
    const result = await updateThread({
      threadId: "thread-1",
      title: "Updated Title",
      isPinned: false,
    });

    expect(mockUpdateThreadInDB).toHaveBeenCalledWith({
      threadId: "thread-1",
      userTitleOverride: "Updated Title",
      pinned: false,
    });
    expect(result).toEqual(defaultThread);
  });

  test("Unit -> updateThread handles only threadId", async () => {
    const result = await updateThread({
      threadId: "thread-1",
    });

    expect(mockUpdateThreadInDB).toHaveBeenCalledWith({
      threadId: "thread-1",
      userTitleOverride: undefined,
      pinned: undefined,
    });
    expect(result).toEqual(defaultThread);
  });

  test("Unit -> updateThread converts database errors to Internal Server Error and logs", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database error");
    mockUpdateThreadInDB.mockRejectedValue(testError);

    try {
      await expect(
        updateThread({ threadId: "thread-1", title: "Test" })
      ).rejects.toThrow("Failed to update thread");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error updating thread:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });
});
