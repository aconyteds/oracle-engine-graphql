import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("updateLocation", () => {
  // Declare mock variables
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockUpdateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let updateLocation: typeof import("./updateLocation").updateLocation;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";
  const defaultLocationId = "asset-location-1";

  const defaultExistingAsset: CampaignAsset = {
    id: defaultLocationId,
    campaignId: defaultCampaignId,
    name: "The Rusty Dragon Inn",
    recordType: RecordType.Location,
    summary: "A popular tavern in town",
    playerSummary: "A cozy inn",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    locationData: {
      imageUrl: "https://example.com/inn.jpg",
      description: "A warm, inviting tavern",
      condition: "Well-maintained",
      pointsOfInterest: "Bar, rooms upstairs",
      characters: "Innkeeper, patrons",
      dmNotes: "Secret passage in cellar",
      sharedWithPlayers: "The inn is popular with adventurers",
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultUpdatedAsset: CampaignAsset = {
    ...defaultExistingAsset,
    locationData: {
      ...defaultExistingAsset.locationData!,
      condition: "Recently renovated",
      sharedWithPlayers: "The inn has been beautifully renovated",
    },
    updatedAt: new Date("2024-01-02"),
  };

  const defaultStringifiedAsset =
    "Name: The Rusty Dragon Inn\nCondition: Recently renovated";

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockVerifyCampaignAssetOwnership = mock();
    mockGetCampaignAssetById = mock();
    mockUpdateCampaignAsset = mock();
    mockStringifyCampaignAsset = mock();

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

    mock.module("../../../../MongoDB/campaignAsset/update", () => ({
      updateCampaignAsset: mockUpdateCampaignAsset,
    }));

    mock.module("../../../../MongoDB/campaignAsset/embedCampaignAsset", () => ({
      embedCampaignAsset: mock(), // Export all from the module even if unused
      stringifyCampaignAsset: mockStringifyCampaignAsset,
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
    const module = await import("./updateLocation");
    updateLocation = module.updateLocation;

    // Configure default behavior
    mockVerifyCampaignAssetOwnership.mockResolvedValue(undefined);
    mockGetCampaignAssetById.mockResolvedValue(defaultExistingAsset);
    mockUpdateCampaignAsset.mockResolvedValue(defaultUpdatedAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> updateLocation updates location with partial fields", async () => {
    const result = await updateLocation(
      {
        locationId: defaultLocationId,
        locationData: {
          condition: "Recently renovated",
          sharedWithPlayers: "The inn has been beautifully renovated",
        },
      },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
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
    expect(mockUpdateCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultLocationId,
      recordType: RecordType.Location,
      name: undefined,
      summary: undefined,
      playerSummary: undefined,
      locationData: {
        condition: "Recently renovated",
        sharedWithPlayers: "The inn has been beautifully renovated",
      },
    });

    expect(result).toContain("<success>");
    expect(result).toContain("Location updated successfully");
    expect(result).toContain(defaultStringifiedAsset);
  });

  test("Unit -> updateLocation updates name and summary", async () => {
    await updateLocation(
      {
        locationId: defaultLocationId,
        name: "The Golden Dragon Inn",
        summary: "A newly renovated tavern",
      },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(mockUpdateCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultLocationId,
      recordType: RecordType.Location,
      name: "The Golden Dragon Inn",
      summary: "A newly renovated tavern",
      playerSummary: undefined,
      locationData: undefined,
    });
  });

  test("Unit -> updateLocation returns error when location not found", async () => {
    mockGetCampaignAssetById.mockResolvedValue(null);

    const result = await updateLocation(
      {
        locationId: "nonexistent-id",
        name: "New Name",
      },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toContain("<error>");
    expect(result).toContain("not found or is not a location");
    expect(mockUpdateCampaignAsset).not.toHaveBeenCalled();
  });

  test("Unit -> updateLocation returns error when user not authorized", async () => {
    const authError = new Error("User not authorized to access this asset");
    mockVerifyCampaignAssetOwnership.mockRejectedValue(authError);

    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await updateLocation(
        {
          locationId: defaultLocationId,
          name: "New Name",
        },
        {
          context: {
            userId: "unauthorized-user",
            campaignId: defaultCampaignId,
            threadId: defaultThreadId,
            runId: defaultRunId,
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

  test("Unit -> updateLocation returns error for type mismatch", async () => {
    const typeMismatchError = new Error(
      "Asset type mismatch: expected Location"
    );
    mockUpdateCampaignAsset.mockRejectedValue(typeMismatchError);

    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await updateLocation(
        {
          locationId: defaultLocationId,
          name: "New Name",
        },
        {
          context: {
            userId: defaultUserId,
            campaignId: defaultCampaignId,
            threadId: defaultThreadId,
            runId: defaultRunId,
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("not a location");
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateLocation handles generic errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const genericError = new Error("Database connection failed");
    mockUpdateCampaignAsset.mockRejectedValue(genericError);

    try {
      const result = await updateLocation(
        {
          locationId: defaultLocationId,
          name: "New Name",
        },
        {
          context: {
            userId: defaultUserId,
            campaignId: defaultCampaignId,
            threadId: defaultThreadId,
            runId: defaultRunId,
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("Failed to update location");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in updateLocation tool:",
        genericError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateLocation returns XML formatted response", async () => {
    const result = await updateLocation(
      {
        locationId: defaultLocationId,
        name: "New Name",
      },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toMatch(/<success>.*<\/success>/s);
    expect(result).toMatch(/<location id="[^"]+" name="[^"]+">.*<\/location>/s);
  });
});
