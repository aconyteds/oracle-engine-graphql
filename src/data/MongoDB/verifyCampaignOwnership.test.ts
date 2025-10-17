import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign } from "./client";

describe("verifyCampaignOwnership", () => {
  // Declare mock variables
  let mockFindUniqueOrThrow: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      findUniqueOrThrow: ReturnType<typeof mock>;
    };
  };
  let mockUnauthorizedError: ReturnType<typeof mock>;
  let verifyCampaignOwnership: (
    campaignId: string,
    userId: string
  ) => Promise<true>;

  // Default mock data
  const defaultCampaign: Campaign = {
    id: "campaign-1",
    ownerId: "user-1",
    name: "Test Campaign",
    setting: "Fantasy",
    tone: "Epic",
    ruleset: "D&D 5e",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFindUniqueOrThrow = mock();
    mockDBClient = {
      campaign: {
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
    const module = await import("./verifyCampaignOwnership");
    verifyCampaignOwnership = module.verifyCampaignOwnership;

    // Configure default mock behavior AFTER import
    mockFindUniqueOrThrow.mockResolvedValue(defaultCampaign);
    mockUnauthorizedError.mockReturnValue(new Error("Unauthorized"));
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> verifyCampaignOwnership returns true when user owns campaign", async () => {
    const result = await verifyCampaignOwnership("campaign-1", "user-1");

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
        ownerId: "user-1",
      },
    });
    expect(result).toBe(true);
  });

  test("Unit -> verifyCampaignOwnership throws UnauthorizedError when campaign not found", () => {
    mockFindUniqueOrThrow.mockRejectedValue(new Error("Not found"));

    expect(verifyCampaignOwnership("campaign-1", "wrong-user")).rejects.toThrow(
      "Unauthorized"
    );

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
        ownerId: "wrong-user",
      },
    });
    expect(mockUnauthorizedError).toHaveBeenCalled();
  });

  test("Unit -> verifyCampaignOwnership throws UnauthorizedError when user is not owner", () => {
    mockFindUniqueOrThrow.mockRejectedValue(new Error("Not found"));

    expect(verifyCampaignOwnership("campaign-1", "user-2")).rejects.toThrow(
      "Unauthorized"
    );

    expect(mockUnauthorizedError).toHaveBeenCalled();
  });
});
