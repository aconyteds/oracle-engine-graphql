import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("verifyThreadOwnership", () => {
  // Declare mock variables
  let mockFindUniqueOrThrow: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findUniqueOrThrow: ReturnType<typeof mock>;
    };
  };
  let mockUnauthorizedError: ReturnType<typeof mock>;
  let verifyThreadOwnership: (
    threadId: string,
    userId: string,
    campaignId?: string
  ) => Promise<true>;

  // Default mock data
  const defaultThread = {
    id: "thread-1",
    title: "Test Thread",
    campaignId: "campaign-1",
    userId: null,
    selectedAgent: "Default Router",
    createdAt: new Date(),
    updatedAt: new Date(),
    campaign: {
      id: "campaign-1",
      ownerId: "user-1",
      name: "Test Campaign",
      setting: "Fantasy",
      tone: "Epic",
      ruleset: "D&D 5e",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFindUniqueOrThrow = mock();
    mockDBClient = {
      thread: {
        findUniqueOrThrow: mockFindUniqueOrThrow,
      },
    };
    mockUnauthorizedError = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("../../graphql/errors", () => ({
      UnauthorizedError: mockUnauthorizedError,
    }));

    // Dynamically import the module under test
    const module = await import("./verifyThreadOwnership");
    verifyThreadOwnership = module.verifyThreadOwnership;

    // Configure default mock behavior AFTER import
    mockFindUniqueOrThrow.mockResolvedValue(defaultThread);
    mockUnauthorizedError.mockReturnValue(new Error("Unauthorized"));
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> verifyThreadOwnership returns true when user owns campaign", async () => {
    const result = await verifyThreadOwnership("thread-1", "user-1");

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "thread-1",
      },
      include: {
        campaign: true,
      },
    });
    expect(result).toBe(true);
  });

  test("Unit -> verifyThreadOwnership verifies thread belongs to campaign when campaignId provided", async () => {
    const result = await verifyThreadOwnership(
      "thread-1",
      "user-1",
      "campaign-1"
    );

    expect(result).toBe(true);
  });

  test("Unit -> verifyThreadOwnership throws when thread belongs to different campaign", async () => {
    await expect(
      verifyThreadOwnership("thread-1", "user-1", "campaign-different")
    ).rejects.toThrow("Thread does not belong to the selected campaign.");

    expect(mockFindUniqueOrThrow).toHaveBeenCalled();
  });

  test("Unit -> verifyThreadOwnership throws UnauthorizedError when user does not own campaign", async () => {
    await expect(
      verifyThreadOwnership("thread-1", "user-different")
    ).rejects.toThrow("Unauthorized");

    expect(mockUnauthorizedError).toHaveBeenCalled();
  });

  test("Unit -> verifyThreadOwnership throws UnauthorizedError when thread not found", async () => {
    mockFindUniqueOrThrow.mockRejectedValue(new Error("Not found"));

    await expect(
      verifyThreadOwnership("thread-nonexistent", "user-1")
    ).rejects.toThrow("Unauthorized");

    expect(mockUnauthorizedError).toHaveBeenCalled();
  });

  test("Unit -> verifyThreadOwnership includes campaign relation in query", async () => {
    await verifyThreadOwnership("thread-1", "user-1");

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          campaign: true,
        },
      })
    );
  });

  test("Unit -> verifyThreadOwnership works without campaignId parameter", async () => {
    const result = await verifyThreadOwnership("thread-1", "user-1");

    expect(result).toBe(true);
    expect(mockFindUniqueOrThrow).toHaveBeenCalled();
  });

  test("Unit -> verifyThreadOwnership handles database errors", async () => {
    const testError = new Error("Database connection failed");
    mockFindUniqueOrThrow.mockRejectedValue(testError);

    await expect(verifyThreadOwnership("thread-1", "user-1")).rejects.toThrow(
      "Unauthorized"
    );

    expect(mockUnauthorizedError).toHaveBeenCalled();
  });
});
