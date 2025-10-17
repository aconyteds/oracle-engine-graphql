import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign, User } from "../../../data/MongoDB";

describe("getLastSelectedCampaign", () => {
  // Declare mock variables
  let mockUserFindUnique: ReturnType<typeof mock>;
  let mockCampaignFindUnique: ReturnType<typeof mock>;
  let mockDBClient: {
    user: {
      findUnique: ReturnType<typeof mock>;
    };
    campaign: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let getLastSelectedCampaign: typeof import("./getLastSelectedCampaign").getLastSelectedCampaign;

  // Default mock data
  const defaultUser: Pick<User, "lastCampaignId"> = {
    lastCampaignId: "campaign-1",
  };

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
    mockUserFindUnique = mock();
    mockCampaignFindUnique = mock();
    mockDBClient = {
      user: {
        findUnique: mockUserFindUnique,
      },
      campaign: {
        findUnique: mockCampaignFindUnique,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./getLastSelectedCampaign");
    getLastSelectedCampaign = module.getLastSelectedCampaign;

    // Configure default mock behavior AFTER import
    mockUserFindUnique.mockResolvedValue(defaultUser);
    mockCampaignFindUnique.mockResolvedValue(defaultCampaign);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getLastSelectedCampaign returns campaign when user has lastCampaignId", async () => {
    const result = await getLastSelectedCampaign("user-1");

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      select: {
        lastCampaignId: true,
      },
    });

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
    });

    expect(result).toEqual(defaultCampaign);
  });

  test("Unit -> getLastSelectedCampaign returns null when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await getLastSelectedCampaign("non-existent-user");

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: {
        id: "non-existent-user",
      },
      select: {
        lastCampaignId: true,
      },
    });

    expect(mockCampaignFindUnique).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test("Unit -> getLastSelectedCampaign returns null when user has no lastCampaignId", async () => {
    mockUserFindUnique.mockResolvedValue({ lastCampaignId: null });

    const result = await getLastSelectedCampaign("user-1");

    expect(mockUserFindUnique).toHaveBeenCalled();
    expect(mockCampaignFindUnique).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test("Unit -> getLastSelectedCampaign returns null when campaign not found", async () => {
    mockCampaignFindUnique.mockResolvedValue(null);

    const result = await getLastSelectedCampaign("user-1");

    expect(mockUserFindUnique).toHaveBeenCalled();
    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
    });
    expect(result).toBeNull();
  });
});
