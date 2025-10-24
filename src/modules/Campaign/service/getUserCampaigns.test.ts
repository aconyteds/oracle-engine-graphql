import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign } from "../../../data/MongoDB";

describe("getUserCampaigns", () => {
  // Declare mock variables
  let mockFindMany: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      findMany: ReturnType<typeof mock>;
    };
  };
  let getUserCampaigns: (userId: string) => Promise<Campaign[]>;

  // Default mock data
  const defaultCampaign: Campaign = {
    id: "campaign-1",
    ownerId: "user-1",
    name: "My Campaign",
    setting: "Fantasy World",
    tone: "Epic",
    ruleset: "D&D 5e",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFindMany = mock();
    mockDBClient = {
      campaign: {
        findMany: mockFindMany,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./getUserCampaigns");
    getUserCampaigns = module.getUserCampaigns;

    // Configure default mock behavior AFTER import
    mockFindMany.mockResolvedValue([defaultCampaign]);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getUserCampaigns returns campaigns for user", async () => {
    const result = await getUserCampaigns("user-1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        ownerId: "user-1",
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(result).toEqual([defaultCampaign]);
  });

  test("Unit -> getUserCampaigns returns empty array when no campaigns", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await getUserCampaigns("user-1");

    expect(result).toEqual([]);
  });

  test("Unit -> getUserCampaigns returns multiple campaigns sorted by updatedAt", async () => {
    const campaign1: Campaign = {
      ...defaultCampaign,
      id: "campaign-1",
      updatedAt: new Date("2025-01-01"),
    };
    const campaign2: Campaign = {
      ...defaultCampaign,
      id: "campaign-2",
      name: "Second Campaign",
      updatedAt: new Date("2025-01-02"),
    };

    mockFindMany.mockResolvedValue([campaign2, campaign1]);

    const result = await getUserCampaigns("user-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("campaign-2");
    expect(result[1].id).toBe("campaign-1");
  });
});
