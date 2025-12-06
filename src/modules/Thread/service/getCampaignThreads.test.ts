import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Thread } from "../../../data/MongoDB";

describe("getCampaignThreads service", () => {
  // Declare mock variables
  let mockGetCampaignThreadsFromDB: ReturnType<typeof mock>;
  let getCampaignThreads: typeof import("./getCampaignThreads").getCampaignThreads;

  // Default mock data
  const defaultThreads: Thread[] = [
    {
      id: "thread-1",
      title: "First Thread",
      campaignId: "campaign-1",
      userId: "user-1",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-03"),
    },
    {
      id: "thread-2",
      title: "Second Thread",
      campaignId: "campaign-1",
      userId: "user-1",
      createdAt: new Date("2025-01-02"),
      updatedAt: new Date("2025-01-02"),
    },
  ];

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockGetCampaignThreadsFromDB = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      getCampaignThreads: mockGetCampaignThreadsFromDB,
    }));

    // Dynamically import the module under test
    const module = await import("./getCampaignThreads");
    getCampaignThreads = module.getCampaignThreads;

    // Configure default mock behavior AFTER import
    mockGetCampaignThreadsFromDB.mockResolvedValue(defaultThreads);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getCampaignThreads calls database layer with campaignId", async () => {
    const result = await getCampaignThreads("campaign-1");

    expect(mockGetCampaignThreadsFromDB).toHaveBeenCalledWith("campaign-1");
    expect(result).toEqual(defaultThreads);
  });

  test("Unit -> getCampaignThreads returns threads from database", async () => {
    const result = await getCampaignThreads("campaign-1");

    expect(result).toEqual(defaultThreads);
    expect(result).toHaveLength(2);
  });

  test("Unit -> getCampaignThreads handles empty result", async () => {
    mockGetCampaignThreadsFromDB.mockResolvedValue([]);

    const result = await getCampaignThreads("campaign-empty");

    expect(result).toEqual([]);
  });

  test("Unit -> getCampaignThreads propagates database errors", async () => {
    const testError = new Error("Database error");
    mockGetCampaignThreadsFromDB.mockRejectedValue(testError);

    await expect(getCampaignThreads("campaign-1")).rejects.toThrow(
      "Database error"
    );
  });
});
