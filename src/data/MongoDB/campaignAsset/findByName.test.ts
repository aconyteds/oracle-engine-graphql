import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("findCampaignAssetByName", () => {
  // Declare mock variables
  let mockFindFirst: ReturnType<typeof mock>;
  let mockDBClient: {
    campaignAsset: {
      findFirst: ReturnType<typeof mock>;
    };
  };
  let findCampaignAssetByName: typeof import("./findByName").findCampaignAssetByName;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultAssetName = "The Rusty Dragon Inn";

  const defaultLocationAsset: CampaignAsset = {
    id: "asset-location-1",
    campaignId: defaultCampaignId,
    name: defaultAssetName,
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

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockFindFirst = mock();
    mockDBClient = {
      campaignAsset: {
        findFirst: mockFindFirst,
      },
    };

    // Set up module mocks
    mock.module("../client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamic import
    const module = await import("./findByName");
    findCampaignAssetByName = module.findCampaignAssetByName;

    // Configure default behavior
    mockFindFirst.mockResolvedValue(defaultLocationAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> findCampaignAssetByName finds asset by exact name", async () => {
    const result = await findCampaignAssetByName({
      campaignId: defaultCampaignId,
      name: defaultAssetName,
    });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
        name: defaultAssetName,
      },
    });
    expect(result).toEqual(defaultLocationAsset);
  });

  test("Unit -> findCampaignAssetByName filters by recordType", async () => {
    const result = await findCampaignAssetByName({
      campaignId: defaultCampaignId,
      name: defaultAssetName,
      recordType: "Location",
    });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
        name: defaultAssetName,
        recordType: RecordType.Location,
      },
    });
    expect(result).toEqual(defaultLocationAsset);
  });

  test("Unit -> findCampaignAssetByName returns null when not found", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await findCampaignAssetByName({
      campaignId: defaultCampaignId,
      name: "Nonexistent Location",
    });

    expect(result).toBeNull();
  });

  test("Unit -> findCampaignAssetByName throws error on database failure", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database connection failed");
    mockFindFirst.mockRejectedValue(testError);

    try {
      await expect(
        findCampaignAssetByName({
          campaignId: defaultCampaignId,
          name: defaultAssetName,
        })
      ).rejects.toThrow(
        `Failed to find campaign asset by name: ${defaultAssetName}`
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to find campaign asset by name:",
        {
          campaignId: defaultCampaignId,
          name: defaultAssetName,
          error: testError,
        }
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> findCampaignAssetByName validates input schema", async () => {
    await expect(
      findCampaignAssetByName({
        campaignId: 123 as any,
        name: null as any,
      })
    ).rejects.toThrow();
  });

  test("Unit -> findCampaignAssetByName works with NPC recordType", async () => {
    const npcAsset: CampaignAsset = {
      ...defaultLocationAsset,
      id: "asset-npc-1",
      recordType: RecordType.NPC,
      gmNotes: "Secret agent",
      playerNotes: "Friendly ranger",
      locationData: null,
      npcData: {
        imageUrl: "https://example.com/npc.jpg",
        physicalDescription: "A tall elf",
        motivation: "Protect the forest",
        mannerisms: "Speaks softly",
      },
    };
    mockFindFirst.mockResolvedValue(npcAsset);

    const result = await findCampaignAssetByName({
      campaignId: defaultCampaignId,
      name: "Ranger Elf",
      recordType: "NPC",
    });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        campaignId: defaultCampaignId,
        name: "Ranger Elf",
        recordType: RecordType.NPC,
      },
    });
    expect(result).toEqual(npcAsset);
  });
});
