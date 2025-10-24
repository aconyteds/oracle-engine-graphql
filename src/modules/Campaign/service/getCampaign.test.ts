import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign } from "../../../data/MongoDB";

describe("getCampaign", () => {
  // Declare mock variables
  let mockFindUnique: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let getCampaign: (campaignId: string) => Promise<Campaign | null>;

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
    mockFindUnique = mock();
    mockDBClient = {
      campaign: {
        findUnique: mockFindUnique,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./getCampaign");
    getCampaign = module.getCampaign;

    // Configure default mock behavior AFTER import
    mockFindUnique.mockResolvedValue(defaultCampaign);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getCampaign returns campaign by ID", async () => {
    const result = await getCampaign("campaign-1");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
    });
    expect(result).toEqual(defaultCampaign);
  });

  test("Unit -> getCampaign returns null when campaign not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getCampaign("non-existent");
    expect(result).toBeNull();

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        id: "non-existent",
      },
    });
  });
});
