import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Thread } from "../../data/MongoDB";

describe("createThreadsByCampaignIdLoader", () => {
  // Declare mock variables
  let mockFindMany: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findMany: ReturnType<typeof mock>;
    };
  };
  let createThreadsByCampaignIdLoader: typeof import("./dataloader").createThreadsByCampaignIdLoader;

  // Default mock data
  const defaultThreads: Thread[] = [
    {
      id: "thread-1",
      title: "Thread 1",
      campaignId: "campaign-1",
      userId: "user-1",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-03"),
    },
    {
      id: "thread-2",
      title: "Thread 2",
      campaignId: "campaign-1",
      userId: "user-1",
      createdAt: new Date("2025-01-02"),
      updatedAt: new Date("2025-01-02"),
    },
    {
      id: "thread-3",
      title: "Thread 3",
      campaignId: "campaign-2",
      userId: "user-1",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  ];

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFindMany = mock();
    mockDBClient = {
      thread: {
        findMany: mockFindMany,
      },
    };

    // Configure default mock behavior BEFORE setting up module mocks
    mockFindMany.mockResolvedValue(defaultThreads);

    // Set up module mocks INSIDE beforeEach
    mock.module("../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./dataloader");
    createThreadsByCampaignIdLoader = module.createThreadsByCampaignIdLoader;
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> createThreadsByCampaignIdLoader creates a DataLoader instance", () => {
    const loader = createThreadsByCampaignIdLoader();

    expect(loader).toBeDefined();
    expect(typeof loader.load).toBe("function");
    expect(typeof loader.loadMany).toBe("function");
  });

  test("Unit -> createThreadsByCampaignIdLoader batches requests in single query", async () => {
    const loader = createThreadsByCampaignIdLoader();

    // Load threads for multiple campaigns
    const promise1 = loader.load("campaign-1");
    const promise2 = loader.load("campaign-2");

    const [threads1, threads2] = await Promise.all([promise1, promise2]);

    // Should only call findMany once with all campaign IDs
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        campaignId: {
          in: ["campaign-1", "campaign-2"],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Results should be correctly grouped by campaign
    expect(threads1).toHaveLength(2);
    expect(threads1[0].id).toBe("thread-1");
    expect(threads1[1].id).toBe("thread-2");

    expect(threads2).toHaveLength(1);
    expect(threads2[0].id).toBe("thread-3");
  });

  test("Unit -> createThreadsByCampaignIdLoader returns empty array for campaign with no threads", async () => {
    mockFindMany.mockResolvedValue([]);

    const loader = createThreadsByCampaignIdLoader();
    const threads = await loader.load("campaign-empty");

    expect(threads).toEqual([]);
  });

  test("Unit -> createThreadsByCampaignIdLoader caches results per request", async () => {
    const loader = createThreadsByCampaignIdLoader();

    // First load
    const threads1 = await loader.load("campaign-1");

    // Second load of same campaign
    const threads2 = await loader.load("campaign-1");

    // Should only call findMany once due to caching
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(threads1).toBe(threads2); // Same reference due to cache
  });

  test("Unit -> createThreadsByCampaignIdLoader maintains order of results", async () => {
    const loader = createThreadsByCampaignIdLoader();

    // Load in specific order
    const promise1 = loader.load("campaign-2");
    const promise2 = loader.load("campaign-1");
    const promise3 = loader.load("campaign-empty");

    const [threads2, threads1, threadsEmpty] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    // Results should match the requested order
    expect(threads2[0].campaignId).toBe("campaign-2");
    expect(threads1[0].campaignId).toBe("campaign-1");
    expect(threadsEmpty).toEqual([]);
  });

  test("Unit -> createThreadsByCampaignIdLoader handles database errors", async () => {
    const testError = new Error("Database connection failed");
    mockFindMany.mockRejectedValue(testError);

    const loader = createThreadsByCampaignIdLoader();

    await expect(loader.load("campaign-1")).rejects.toThrow(
      "Database connection failed"
    );
  });

  test("Unit -> createThreadsByCampaignIdLoader creates separate loaders per request", async () => {
    // Simulate two separate requests
    const loader1 = createThreadsByCampaignIdLoader();
    const loader2 = createThreadsByCampaignIdLoader();

    await loader1.load("campaign-1");
    await loader2.load("campaign-1");

    // Each loader should make its own query (no shared cache)
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });

  test("Unit -> createThreadsByCampaignIdLoader orders threads by updatedAt descending", async () => {
    const loader = createThreadsByCampaignIdLoader();

    await loader.load("campaign-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          updatedAt: "desc",
        },
      })
    );
  });
});
