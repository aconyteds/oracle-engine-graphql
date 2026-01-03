import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { RequestContext } from "../types";

describe("yieldProgressToUser", () => {
  let yieldProgressToUser: typeof import("./yieldProgress").yieldProgressToUser;
  let mockMessageFactory: {
    progress: ReturnType<typeof mock>;
  };
  let mockYieldMessage: ReturnType<typeof mock>;

  const defaultProgressPayload = {
    responseType: "Intermediate",
    content: "⚙️ Test progress message",
  };

  let defaultContext: RequestContext;

  beforeEach(async () => {
    mock.restore();

    mockYieldMessage = mock();

    const mockProgress = mock();
    mockMessageFactory = {
      progress: mockProgress,
    };

    mock.module("../messageFactory", () => ({
      MessageFactory: mockMessageFactory,
    }));

    // Dynamically import the module under test
    const module = await import("./yieldProgress");
    yieldProgressToUser = module.yieldProgressToUser;

    // Configure default mock behavior
    mockMessageFactory.progress.mockReturnValue(defaultProgressPayload);

    // Recreate defaultContext with fresh mockYieldMessage
    defaultContext = {
      userId: "user-123",
      campaignId: "campaign-456",
      threadId: "thread-789",
      runId: "run-abc",
      yieldMessage: mockYieldMessage,
    };
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> yieldProgressToUser yields progress message successfully", async () => {
    const result = await yieldProgressToUser(
      { message: "Creating character..." },
      { context: defaultContext }
    );

    expect(result).toBe("message sent");
    expect(mockMessageFactory.progress).toHaveBeenCalledWith(
      "Creating character..."
    );
    expect(mockYieldMessage).toHaveBeenCalledWith(defaultProgressPayload);
  });

  test("Unit -> yieldProgressToUser handles missing yieldMessage gracefully", async () => {
    const originalWarn = console.warn;
    const consoleWarnSpy = mock();
    console.warn = consoleWarnSpy;

    try {
      const contextWithoutYield = {
        userId: defaultContext.userId,
        campaignId: defaultContext.campaignId,
        threadId: defaultContext.threadId,
        runId: defaultContext.runId,
      };

      const result = await yieldProgressToUser(
        { message: "Some progress" },
        // biome-ignore lint/suspicious/noExplicitAny: Testing missing yieldMessage
        { context: contextWithoutYield as any }
      );

      expect(result).toBe("Progress message queued (no yield available)");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "yieldMessage not available in context"
      );
    } finally {
      console.warn = originalWarn;
    }
  });

  test("Unit -> yieldProgressToUser validates input schema", async () => {
    // Missing required field should throw
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing schema validation
      yieldProgressToUser({} as any, { context: defaultContext })
    ).rejects.toThrow();

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> yieldProgressToUser handles different message types", async () => {
    const messages = [
      "Analyzing data...",
      "Building response...",
      "Finalizing output...",
    ];

    for (const msg of messages) {
      await yieldProgressToUser({ message: msg }, { context: defaultContext });
    }

    expect(mockMessageFactory.progress).toHaveBeenCalledTimes(3);
    expect(mockYieldMessage).toHaveBeenCalledTimes(3);

    messages.forEach((msg) => {
      expect(mockMessageFactory.progress).toHaveBeenCalledWith(msg);
    });
  });
});
