import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Thread } from "./client";

describe("getCampaignThreads", () => {
  // Declare mock variables
  let mockFindMany: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findMany: ReturnType<typeof mock>;
    };
  };
  let getCampaignThreads: typeof import("./getCampaignThreads").getCampaignThreads;

  // Default mock data
  const defaultThreads: Thread[] = [
    {
      id: "thread-1",
      title: "First Thread",
      campaignId: "campaign-1",
      userId: null,
      selectedAgent: "Default Router",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-03"),
    },
    {
      id: "thread-2",
      title: "Second Thread",
      campaignId: "campaign-1",
      userId: null,
      selectedAgent: "Default Router",
      createdAt: new Date("2025-01-02"),
      updatedAt: new Date("2025-01-02"),
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

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./getCampaignThreads");
    getCampaignThreads = module.getCampaignThreads;

    // Configure default mock behavior AFTER import
    mockFindMany.mockResolvedValue(defaultThreads);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getCampaignThreads returns threads for campaignId", async () => {
    const result = await getCampaignThreads("campaign-1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(result).toEqual(defaultThreads);
  });

  test("Unit -> getCampaignThreads orders threads by updatedAt desc", async () => {
    await getCampaignThreads("campaign-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          updatedAt: "desc",
        },
      })
    );
  });

  test("Unit -> getCampaignThreads returns empty array when no threads found", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await getCampaignThreads("campaign-empty");

    expect(result).toEqual([]);
  });

  test("Unit -> getCampaignThreads queries with correct campaignId", async () => {
    await getCampaignThreads("campaign-different");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-different",
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  });

  test("Unit -> getCampaignThreads handles database errors", async () => {
    const testError = new Error("Database connection failed");
    mockFindMany.mockRejectedValue(testError);

    await expect(getCampaignThreads("campaign-1")).rejects.toThrow(
      "Database connection failed"
    );

    expect(mockFindMany).toHaveBeenCalled();
  });
});
