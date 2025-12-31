import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";

describe("updateCampaignAsset", () => {
  // Declare mock variables with 'let'
  let mockFindUnique: ReturnType<typeof mock>;
  let mockUpdate: ReturnType<typeof mock>;
  let mockEmbedCampaignAsset: ReturnType<typeof mock>;
  let mockDBClient: {
    campaignAsset: {
      findUnique: ReturnType<typeof mock>;
      update: ReturnType<typeof mock>;
    };
  };
  let updateCampaignAsset: typeof import("./update").updateCampaignAsset;

  // Default mock data
  const defaultPlotAsset: CampaignAsset = {
    id: "asset-1",
    campaignId: "campaign-1",
    name: "Test Plot",
    recordType: RecordType.Plot,
    summary: "Test summary",
    playerSummary: "Player summary",
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [0.1, 0.2, 0.3],
    locationData: null,
    npcData: null,
    plotData: {
      dmNotes: "DM notes",
      sharedWithPlayers: "Shared info",
      status: PlotStatus.InProgress,
      urgency: Urgency.TimeSensitive,
    },
    sessionEventLink: [],
  };

  const defaultLocationAsset: CampaignAsset = {
    id: "asset-2",
    campaignId: "campaign-1",
    name: "Test Location",
    recordType: RecordType.Location,
    summary: "Test summary",
    playerSummary: "Player summary",
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [0.1, 0.2, 0.3],
    plotData: null,
    npcData: null,
    locationData: {
      imageUrl: "https://example.com/image.jpg",
      description: "A dark forest",
      condition: "Foggy",
      pointsOfInterest: "Ancient ruins",
      characters: "Guards",
      dmNotes: "Secret trap",
      sharedWithPlayers: "Looks dangerous",
    },
    sessionEventLink: [],
  };

  const defaultNPCAsset: CampaignAsset = {
    id: "asset-3",
    campaignId: "campaign-1",
    name: "Test NPC",
    recordType: RecordType.NPC,
    summary: "Test summary",
    playerSummary: "Player summary",
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [0.1, 0.2, 0.3],
    plotData: null,
    locationData: null,
    npcData: {
      imageUrl: "https://example.com/npc.jpg",
      physicalDescription: "Tall and imposing",
      motivation: "Seeks revenge",
      mannerisms: "Speaks softly",
      dmNotes: "Secret identity",
      sharedWithPlayers: "Mysterious figure",
    },
    sessionEventLink: [],
  };

  const defaultEmbeddings = [0.4, 0.5, 0.6];

  beforeEach(async () => {
    // Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFindUnique = mock();
    mockUpdate = mock();
    mockEmbedCampaignAsset = mock();

    mockDBClient = {
      campaignAsset: {
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
    };

    // Set up module mocks
    mock.module("../client", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("./embedCampaignAsset", () => ({
      embedCampaignAsset: mockEmbedCampaignAsset,
    }));

    // Dynamically import the module under test
    const module = await import("./update");
    updateCampaignAsset = module.updateCampaignAsset;

    // Configure default mock behavior
    mockFindUnique.mockResolvedValue(defaultPlotAsset);
    mockUpdate.mockResolvedValue(defaultPlotAsset);
    mockEmbedCampaignAsset.mockResolvedValue(defaultEmbeddings);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> updateCampaignAsset throws error if asset not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      updateCampaignAsset({
        assetId: "non-existent",
        recordType: RecordType.Plot,
        name: "New Name",
      })
    ).rejects.toThrow("Campaign asset with id non-existent not found");
  });

  test("Unit -> updateCampaignAsset throws error if recordType mismatch", async () => {
    mockFindUnique.mockResolvedValue(defaultPlotAsset);

    await expect(
      updateCampaignAsset({
        assetId: "asset-1",
        recordType: RecordType.Location,
        name: "New Name",
      })
    ).rejects.toThrow("Asset type mismatch: expected Location, got Plot");
  });

  test("Unit -> updateCampaignAsset updates name without regenerating embeddings", async () => {
    const updatedAsset = { ...defaultPlotAsset, name: "Updated Name" };
    mockUpdate.mockResolvedValue(updatedAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-1",
      recordType: RecordType.Plot,
      name: "Updated Name",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { name: "Updated Name" },
    });
    expect(mockEmbedCampaignAsset).toHaveBeenCalledWith(updatedAsset);
    expect(result).toEqual(updatedAsset);
  });

  test("Unit -> updateCampaignAsset updates summary and regenerates embeddings", async () => {
    const updatedAsset = { ...defaultPlotAsset, summary: "New summary" };
    const finalAsset = { ...updatedAsset, Embeddings: defaultEmbeddings };
    mockUpdate.mockResolvedValueOnce(updatedAsset);
    mockUpdate.mockResolvedValueOnce(finalAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-1",
      recordType: RecordType.Plot,
      summary: "New summary",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockEmbedCampaignAsset).toHaveBeenCalledWith(updatedAsset);
    expect(result).toEqual(finalAsset);
  });

  test("Unit -> updateCampaignAsset updates plotData and merges with existing fields", async () => {
    const updatedAsset = {
      ...defaultPlotAsset,
      plotData: {
        ...defaultPlotAsset.plotData!,
        dmNotes: "Updated DM notes",
        status: PlotStatus.Closed,
      },
    };
    const finalAsset = { ...updatedAsset, Embeddings: defaultEmbeddings };
    mockUpdate.mockResolvedValueOnce(updatedAsset);
    mockUpdate.mockResolvedValueOnce(finalAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-1",
      recordType: RecordType.Plot,
      plotData: {
        dmNotes: "Updated DM notes",
        status: PlotStatus.Closed,
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: {
        plotData: {
          set: {
            dmNotes: "Updated DM notes",
            sharedWithPlayers: "Shared info",
            status: PlotStatus.Closed,
            urgency: Urgency.TimeSensitive,
          },
        },
      },
    });
    expect(result).toEqual(finalAsset);
  });

  test("Unit -> updateCampaignAsset updates locationData fields", async () => {
    mockFindUnique.mockResolvedValue(defaultLocationAsset);
    const updatedAsset = {
      ...defaultLocationAsset,
      locationData: {
        ...defaultLocationAsset.locationData!,
        description: "Updated description",
        condition: "Sunny",
      },
    };
    const finalAsset = { ...updatedAsset, Embeddings: defaultEmbeddings };
    mockUpdate.mockResolvedValueOnce(updatedAsset);
    mockUpdate.mockResolvedValueOnce(finalAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-2",
      recordType: RecordType.Location,
      locationData: {
        description: "Updated description",
        condition: "Sunny",
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "asset-2" },
      data: {
        locationData: {
          set: {
            imageUrl: "https://example.com/image.jpg",
            description: "Updated description",
            condition: "Sunny",
            pointsOfInterest: "Ancient ruins",
            characters: "Guards",
            dmNotes: "Secret trap",
            sharedWithPlayers: "Looks dangerous",
          },
        },
      },
    });
    expect(result).toEqual(finalAsset);
  });

  test("Unit -> updateCampaignAsset updates npcData fields", async () => {
    mockFindUnique.mockResolvedValue(defaultNPCAsset);
    const updatedAsset = {
      ...defaultNPCAsset,
      npcData: {
        ...defaultNPCAsset.npcData!,
        motivation: "Seeks peace",
        mannerisms: "Laughs loudly",
      },
    };
    const finalAsset = { ...updatedAsset, Embeddings: defaultEmbeddings };
    mockUpdate.mockResolvedValueOnce(updatedAsset);
    mockUpdate.mockResolvedValueOnce(finalAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-3",
      recordType: RecordType.NPC,
      npcData: {
        motivation: "Seeks peace",
        mannerisms: "Laughs loudly",
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "asset-3" },
      data: {
        npcData: {
          set: {
            imageUrl: "https://example.com/npc.jpg",
            physicalDescription: "Tall and imposing",
            motivation: "Seeks peace",
            mannerisms: "Laughs loudly",
            dmNotes: "Secret identity",
            sharedWithPlayers: "Mysterious figure",
          },
        },
      },
    });
    expect(result).toEqual(finalAsset);
  });

  test("Unit -> updateCampaignAsset only updates provided fields", async () => {
    const updatedAsset = {
      ...defaultPlotAsset,
      playerSummary: "New player summary",
    };
    mockUpdate.mockResolvedValue(updatedAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-1",
      recordType: RecordType.Plot,
      playerSummary: "New player summary",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { playerSummary: "New player summary" },
    });
    expect(mockEmbedCampaignAsset).not.toHaveBeenCalled();
    expect(result).toEqual(updatedAsset);
  });

  test("Unit -> updateCampaignAsset throws error if update returns null", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockUpdate.mockResolvedValue(null);

    try {
      await expect(
        updateCampaignAsset({
          assetId: "asset-1",
          recordType: RecordType.Plot,
          name: "New Name",
        })
      ).rejects.toThrow("Failed to update campaign asset");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Asset update returned null or undefined:",
        {
          assetId: "asset-1",
          updateData: { name: "New Name" },
        }
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateCampaignAsset throws error if embeddings generation fails", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const updatedAsset = { ...defaultPlotAsset, name: "New Name" };
    mockUpdate.mockResolvedValue(updatedAsset);
    mockEmbedCampaignAsset.mockResolvedValue(null);

    try {
      await expect(
        updateCampaignAsset({
          assetId: "asset-1",
          recordType: RecordType.Plot,
          name: "New Name",
        })
      ).rejects.toThrow("Failed to generate embeddings");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Embedding generation returned null or undefined:",
        { assetId: "asset-1" }
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateCampaignAsset throws error if embedding update fails", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const updatedAsset = { ...defaultPlotAsset, name: "New Name" };
    mockUpdate.mockResolvedValueOnce(updatedAsset);
    mockUpdate.mockResolvedValueOnce(null);

    try {
      await expect(
        updateCampaignAsset({
          assetId: "asset-1",
          recordType: RecordType.Plot,
          name: "New Name",
        })
      ).rejects.toThrow("Failed to update campaign asset with embeddings");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Asset failed to be updated with embeddings:",
        { assetId: "asset-1" }
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateCampaignAsset validates input schema", async () => {
    await expect(
      updateCampaignAsset({
        assetId: "asset-1",
        recordType: RecordType.Plot,
        name: "A", // Too short (min 2)
      } as Parameters<typeof updateCampaignAsset>[0])
    ).rejects.toThrow();
  });

  test("Unit -> updateCampaignAsset handles multiple field updates", async () => {
    const updatedAsset = {
      ...defaultPlotAsset,
      name: "New Name",
      summary: "New summary",
      playerSummary: "New player summary",
      plotData: {
        ...defaultPlotAsset.plotData!,
        status: PlotStatus.Closed,
      },
    };
    const finalAsset = { ...updatedAsset, Embeddings: defaultEmbeddings };
    mockUpdate.mockResolvedValueOnce(updatedAsset);
    mockUpdate.mockResolvedValueOnce(finalAsset);

    const result = await updateCampaignAsset({
      assetId: "asset-1",
      recordType: RecordType.Plot,
      name: "New Name",
      summary: "New summary",
      playerSummary: "New player summary",
      plotData: {
        status: PlotStatus.Closed,
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: {
        name: "New Name",
        summary: "New summary",
        playerSummary: "New player summary",
        plotData: {
          set: {
            dmNotes: "DM notes",
            sharedWithPlayers: "Shared info",
            status: PlotStatus.Closed,
            urgency: Urgency.TimeSensitive,
          },
        },
      },
    });
    expect(result).toEqual(finalAsset);
  });
});
