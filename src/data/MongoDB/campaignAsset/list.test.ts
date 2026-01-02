import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("listCampaignAssets", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockDBClient: {
    campaignAsset: {
      findMany: ReturnType<typeof mock>;
    };
  };
  let listCampaignAssets: typeof import("./list").listCampaignAssets;

  // Default mock data - reusable across tests
  const defaultCampaignId = "507f1f77bcf86cd799439011";
  const defaultAssetId1 = "507f1f77bcf86cd799439012";
  const defaultAssetId2 = "507f1f77bcf86cd799439013";
  const defaultAssetId3 = "507f1f77bcf86cd799439014";

  const defaultLocationAsset: CampaignAsset = {
    id: defaultAssetId1,
    campaignId: defaultCampaignId,
    name: "Dark Forest",
    recordType: RecordType.Location,
    gmSummary: "A mysterious forest",
    gmNotes: "Hidden treasure",
    playerSummary: "Known for disappearances",
    playerNotes: "Strange disappearances",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-03"),
    Embeddings: [],
    locationData: {
      imageUrl: "https://example.com/location.jpg",
      description: "A dark and mysterious forest",
      condition: "Dense foliage",
      pointsOfInterest: "Ancient ruins",
      characters: "Forest guardian",
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultNPCAsset: CampaignAsset = {
    id: defaultAssetId2,
    campaignId: defaultCampaignId,
    name: "Elven Ranger",
    recordType: RecordType.NPC,
    gmSummary: "A mysterious elf",
    gmNotes: "Secretly working with villain",
    playerSummary: "Helpful and trustworthy",
    playerNotes: "Seems trustworthy",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    Embeddings: [],
    locationData: null,
    npcData: {
      imageUrl: "https://example.com/npc.jpg",
      physicalDescription: "A tall elf with silver hair",
      motivation: "Seeking revenge",
      mannerisms: "Speaks softly",
    },
    plotData: null,
    sessionEventLink: [],
  };

  const defaultPlotAsset: CampaignAsset = {
    id: defaultAssetId3,
    campaignId: defaultCampaignId,
    name: "Missing Artifact",
    recordType: RecordType.Plot,
    gmSummary: "A powerful artifact has been stolen",
    gmNotes: "The artifact is cursed",
    playerSummary: "The town is in uproar",
    playerNotes: "A powerful artifact has been stolen",
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    locationData: null,
    npcData: null,
    plotData: {
      status: "InProgress",
      urgency: "TimeSensitive",
    },
    sessionEventLink: [],
  };

  const defaultAssets = [
    defaultLocationAsset,
    defaultNPCAsset,
    defaultPlotAsset,
  ];

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    const mockFindMany = mock();
    mockDBClient = {
      campaignAsset: {
        findMany: mockFindMany,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./list");
    listCampaignAssets = module.listCampaignAssets;

    // Configure default mock behavior AFTER import
    mockDBClient.campaignAsset.findMany.mockResolvedValue(defaultAssets);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> listCampaignAssets returns all assets for a campaign", async () => {
    const result = await listCampaignAssets({
      campaignId: defaultCampaignId,
    });

    expect(mockDBClient.campaignAsset.findMany).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    expect(result).toEqual(defaultAssets);
    expect(result).toHaveLength(3);
  });

  test("Unit -> listCampaignAssets filters by recordType", async () => {
    const locationAssets = [defaultLocationAsset];
    mockDBClient.campaignAsset.findMany.mockResolvedValue(locationAssets);

    const result = await listCampaignAssets({
      campaignId: defaultCampaignId,
      recordType: RecordType.Location,
    });

    expect(mockDBClient.campaignAsset.findMany).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
        recordType: RecordType.Location,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    expect(result).toEqual(locationAssets);
    expect(result).toHaveLength(1);
    expect(result[0].recordType).toBe(RecordType.Location);
  });

  test("Unit -> listCampaignAssets limits results when limit is provided", async () => {
    const limitedAssets = [defaultLocationAsset, defaultNPCAsset];
    mockDBClient.campaignAsset.findMany.mockResolvedValue(limitedAssets);

    const result = await listCampaignAssets({
      campaignId: defaultCampaignId,
      limit: 2,
    });

    expect(mockDBClient.campaignAsset.findMany).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 2,
    });

    expect(result).toEqual(limitedAssets);
    expect(result).toHaveLength(2);
  });

  test("Unit -> listCampaignAssets combines recordType filter and limit", async () => {
    const npcAssets = [defaultNPCAsset];
    mockDBClient.campaignAsset.findMany.mockResolvedValue(npcAssets);

    const result = await listCampaignAssets({
      campaignId: defaultCampaignId,
      recordType: RecordType.NPC,
      limit: 1,
    });

    expect(mockDBClient.campaignAsset.findMany).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
        recordType: RecordType.NPC,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 1,
    });

    expect(result).toEqual(npcAssets);
    expect(result).toHaveLength(1);
  });

  test("Unit -> listCampaignAssets does not include take when limit is not provided", async () => {
    await listCampaignAssets({
      campaignId: defaultCampaignId,
    });

    const callArgs = mockDBClient.campaignAsset.findMany.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("take");
  });

  test("Unit -> listCampaignAssets returns empty array when no assets found", async () => {
    mockDBClient.campaignAsset.findMany.mockResolvedValue([]);

    const result = await listCampaignAssets({
      campaignId: defaultCampaignId,
    });

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  test("Unit -> listCampaignAssets handles database errors with console logging", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const dbError = new Error("Database connection failed");
    mockDBClient.campaignAsset.findMany.mockRejectedValue(dbError);

    try {
      await expect(
        listCampaignAssets({
          campaignId: defaultCampaignId,
        })
      ).rejects.toThrow(
        `Failed to list campaign assets for campaign: ${defaultCampaignId}`
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to list campaign assets:",
        {
          campaignId: defaultCampaignId,
          recordType: undefined,
          error: dbError,
        }
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> listCampaignAssets validates limit is positive integer", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
      limit: -1,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(listCampaignAssets(invalidInput as any)).rejects.toThrow();
  });

  test("Unit -> listCampaignAssets validates limit is integer (not float)", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
      limit: 2.5,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(listCampaignAssets(invalidInput as any)).rejects.toThrow();
  });

  test("Unit -> listCampaignAssets validates campaignId is required", async () => {
    const invalidInput = {
      limit: 5,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(listCampaignAssets(invalidInput as any)).rejects.toThrow();
  });

  test("Unit -> listCampaignAssets validates recordType is valid enum", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
      recordType: "InvalidType",
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(listCampaignAssets(invalidInput as any)).rejects.toThrow();
  });
});
