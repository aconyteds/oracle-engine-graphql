import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("verifyCampaignAssetOwnership", () => {
  // Declare mock variables
  let mockCampaignAssetFindUniqueOrThrow: ReturnType<typeof mock>;
  let mockDBClient: {
    campaignAsset: {
      findUniqueOrThrow: ReturnType<typeof mock>;
    };
  };
  let mockUnauthorizedError: ReturnType<typeof mock>;
  let verifyCampaignAssetOwnership: (
    assetId: string,
    userId: string
  ) => Promise<true>;

  // Default mock data
  const defaultAsset = {
    id: "asset-1",
    campaignId: "campaign-1",
    campaign: {
      ownerId: "user-1",
    },
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCampaignAssetFindUniqueOrThrow = mock();
    mockDBClient = {
      campaignAsset: {
        findUniqueOrThrow: mockCampaignAssetFindUniqueOrThrow,
      },
    };
    mockUnauthorizedError = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("../client", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("../../../graphql/errors", () => ({
      UnauthorizedError: mockUnauthorizedError,
    }));

    // Dynamically import the module under test
    const module = await import("./verifyCampaignAssetOwnership");
    verifyCampaignAssetOwnership = module.verifyCampaignAssetOwnership;

    // Configure default mock behavior AFTER import
    mockCampaignAssetFindUniqueOrThrow.mockResolvedValue(defaultAsset);
    mockUnauthorizedError.mockReturnValue(new Error("Unauthorized"));
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> verifyCampaignAssetOwnership returns true when user owns the campaign", async () => {
    const result = await verifyCampaignAssetOwnership("asset-1", "user-1");

    expect(mockCampaignAssetFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "asset-1",
      },
      include: {
        campaign: {
          select: {
            ownerId: true,
          },
        },
      },
    });
    expect(result).toBe(true);
  });

  test("Unit -> verifyCampaignAssetOwnership throws UnauthorizedError when user does not own the campaign", async () => {
    await expect(
      verifyCampaignAssetOwnership("asset-1", "user-2")
    ).rejects.toThrow("Unauthorized");

    expect(mockCampaignAssetFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "asset-1",
      },
      include: {
        campaign: {
          select: {
            ownerId: true,
          },
        },
      },
    });
    expect(mockUnauthorizedError).toHaveBeenCalled();
  });

  test("Unit -> verifyCampaignAssetOwnership throws UnauthorizedError when asset not found", async () => {
    mockCampaignAssetFindUniqueOrThrow.mockRejectedValue(
      new Error("Record not found")
    );

    await expect(
      verifyCampaignAssetOwnership("nonexistent-id", "user-1")
    ).rejects.toThrow("Unauthorized");

    expect(mockCampaignAssetFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "nonexistent-id",
      },
      include: {
        campaign: {
          select: {
            ownerId: true,
          },
        },
      },
    });
    expect(mockUnauthorizedError).toHaveBeenCalled();
  });

  test("Unit -> verifyCampaignAssetOwnership verifies different user and asset", async () => {
    const differentAsset = {
      id: "asset-2",
      campaignId: "campaign-2",
      campaign: {
        ownerId: "user-2",
      },
    };

    mockCampaignAssetFindUniqueOrThrow.mockResolvedValue(differentAsset);

    const result = await verifyCampaignAssetOwnership("asset-2", "user-2");

    expect(mockCampaignAssetFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "asset-2",
      },
      include: {
        campaign: {
          select: {
            ownerId: true,
          },
        },
      },
    });
    expect(result).toBe(true);
  });
});
