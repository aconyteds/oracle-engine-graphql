import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";
import { RequestContext } from "../../../types";

describe("deleteLocation", () => {
  // Declare mock variables
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockDeleteCampaignAsset: ReturnType<typeof mock>;
  let deleteLocation: typeof import("./deleteLocation").deleteLocation;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";
  const defaultLocationId = "asset-location-1";
  let defaultContext: RequestContext = {
    userId: defaultUserId,
    campaignId: defaultCampaignId,
    threadId: defaultThreadId,
    runId: defaultRunId,
    yieldMessage: () => {},
  };

  const defaultExistingAsset: CampaignAsset = {
    id: defaultLocationId,
    campaignId: defaultCampaignId,
    name: "The Rusty Dragon Inn",
    recordType: RecordType.Location,
    gmSummary: "A popular tavern in town",
    gmNotes: "Secret passage in cellar",
    playerSummary: "A cozy inn",
    playerNotes: "The inn is popular with adventurers",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    locationData: {
      imageUrl: "https://example.com/inn.jpg",
      description: "A warm, inviting tavern",
      condition: "Well-maintained",
      pointsOfInterest: "Bar, rooms upstairs",
      characters: "Innkeeper, patrons",
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultDeleteResult = {
    success: true,
    assetId: defaultLocationId,
  };

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockVerifyCampaignAssetOwnership = mock();
    mockGetCampaignAssetById = mock();
    mockDeleteCampaignAsset = mock();

    // Set up module mocks - mock specific submodules instead of barrel exports
    mock.module(
      "../../../../MongoDB/campaignAsset/verifyCampaignAssetOwnership",
      () => ({
        verifyCampaignAssetOwnership: mockVerifyCampaignAssetOwnership,
      })
    );

    mock.module("../../../../MongoDB/campaignAsset/getById", () => ({
      getCampaignAssetById: mockGetCampaignAssetById,
    }));

    mock.module("../../../../MongoDB/campaignAsset/delete", () => ({
      deleteCampaignAsset: mockDeleteCampaignAsset,
    }));

    // Mock createEmbeddings to prevent circular dependency via agentList
    mock.module("../../createEmbeddings", () => ({
      createEmbeddings: mock(),
    }));

    // Mock the locationAgent to break circular dependency
    mock.module("../../../Agents/locationAgent", () => ({
      locationAgent: {
        name: "location_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./deleteLocation");
    deleteLocation = module.deleteLocation;

    // Configure default behavior
    mockVerifyCampaignAssetOwnership.mockResolvedValue(undefined);
    mockGetCampaignAssetById.mockResolvedValue(defaultExistingAsset);
    mockDeleteCampaignAsset.mockResolvedValue(defaultDeleteResult);
    defaultContext = {
      userId: defaultUserId,
      campaignId: defaultCampaignId,
      threadId: defaultThreadId,
      runId: defaultRunId,
      yieldMessage: () => {},
    };
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> deleteLocation deletes location successfully", async () => {
    const result = await deleteLocation(
      {
        locationId: defaultLocationId,
      },
      {
        context: defaultContext,
      }
    );

    expect(mockVerifyCampaignAssetOwnership).toHaveBeenCalledWith(
      defaultLocationId,
      defaultUserId
    );
    expect(mockGetCampaignAssetById).toHaveBeenCalledWith({
      assetId: defaultLocationId,
      recordType: RecordType.Location,
    });
    expect(mockDeleteCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultLocationId,
    });

    expect(result).toContain("<success>");
    expect(result).toContain("permanently deleted");
    expect(result).toContain("The Rusty Dragon Inn");
    expect(result).toContain(defaultLocationId);
  });

  test("Unit -> deleteLocation returns error when location not found", async () => {
    mockGetCampaignAssetById.mockResolvedValue(null);

    const result = await deleteLocation(
      {
        locationId: "nonexistent-id",
      },
      {
        context: defaultContext,
      }
    );

    expect(result).toContain("<error>");
    expect(result).toContain("not found or is not a location");
    expect(mockDeleteCampaignAsset).not.toHaveBeenCalled();
  });

  test("Unit -> deleteLocation returns error when user not authorized", async () => {
    const authError = new Error("User not authorized to access this asset");
    mockVerifyCampaignAssetOwnership.mockRejectedValue(authError);

    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await deleteLocation(
        {
          locationId: defaultLocationId,
        },
        {
          context: {
            ...defaultContext,
            userId: "unauthorized-user",
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("not authorized");
      expect(mockGetCampaignAssetById).not.toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> deleteLocation returns error when deletion fails", async () => {
    mockDeleteCampaignAsset.mockResolvedValue({ success: false });

    const result = await deleteLocation(
      {
        locationId: defaultLocationId,
      },
      {
        context: defaultContext,
      }
    );

    expect(result).toContain("<error>");
    expect(result).toContain("Failed to delete location");
  });

  test("Unit -> deleteLocation handles generic errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const genericError = new Error("Database transaction failed");
    mockDeleteCampaignAsset.mockRejectedValue(genericError);

    try {
      const result = await deleteLocation(
        {
          locationId: defaultLocationId,
        },
        {
          context: defaultContext,
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("Failed to delete location");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in deleteLocation tool:",
        genericError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> deleteLocation validates input schema", async () => {
    await expect(
      deleteLocation({ locationId: 123 } as any, {
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> deleteLocation returns XML formatted response on success", async () => {
    const result = await deleteLocation(
      {
        locationId: defaultLocationId,
      },
      {
        context: defaultContext,
      }
    );

    expect(result).toMatch(/<success>.*<\/success>/);
  });
});
