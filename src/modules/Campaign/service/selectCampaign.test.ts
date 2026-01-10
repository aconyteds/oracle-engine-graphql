import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { User } from "../../../data/MongoDB";

describe("selectCampaign", () => {
  // Declare mock variables
  let mockUpdate: ReturnType<typeof mock>;
  let mockDBClient: {
    user: {
      update: ReturnType<typeof mock>;
    };
  };
  let selectCampaign: typeof import("./selectCampaign").selectCampaign;

  // Default mock data
  const defaultUser: User = {
    id: "user-1",
    googleAccountId: "google-123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
    active: true,
    lastCampaignId: "campaign-1",
    subscriptionTier: "Free",
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockUpdate = mock();
    mockDBClient = {
      user: {
        update: mockUpdate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./selectCampaign");
    selectCampaign = module.selectCampaign;

    // Configure default mock behavior AFTER import
    mockUpdate.mockResolvedValue(defaultUser);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> selectCampaign updates user's lastCampaignId", async () => {
    const result = await selectCampaign("user-1", "campaign-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        lastCampaignId: "campaign-1",
      },
    });
    expect(result).toEqual(defaultUser);
  });

  test("Unit -> selectCampaign handles different campaign selection", async () => {
    const updatedUser: User = {
      ...defaultUser,
      lastCampaignId: "campaign-2",
    };

    mockUpdate.mockResolvedValue(updatedUser);

    const result = await selectCampaign("user-1", "campaign-2");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        lastCampaignId: "campaign-2",
      },
    });
    expect(result.lastCampaignId).toBe("campaign-2");
  });
});
