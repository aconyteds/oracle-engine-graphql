import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";

describe("createCampaignAsset", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockEmbedCampaignAsset: ReturnType<typeof mock>;
  let mockDBClient: {
    campaignAsset: {
      create: ReturnType<typeof mock>;
      update: ReturnType<typeof mock>;
    };
  };
  let createCampaignAsset: typeof import("./create").createCampaignAsset;

  // Default mock data - reusable across tests
  const defaultCampaignId = "507f1f77bcf86cd799439011";
  const defaultAssetId = "507f1f77bcf86cd799439012";

  const defaultLocationData = {
    imageUrl: "https://example.com/location.jpg",
    description: "A dark and mysterious forest",
    condition: "Dense foliage, difficult terrain",
    pointsOfInterest: "Ancient ruins, hidden cave",
    characters: "Forest guardian, local bandits",
    dmNotes: "Hidden treasure map in the ruins",
    sharedWithPlayers: "The forest is known for strange disappearances",
  };

  const defaultNPCData = {
    imageUrl: "https://example.com/npc.jpg",
    physicalDescription: "A tall elf with silver hair",
    motivation: "Seeking revenge for their fallen village",
    mannerisms: "Speaks softly, avoids eye contact",
    dmNotes: "Secretly working with the villain",
    sharedWithPlayers: "Seems trustworthy and helpful",
  };

  const defaultPlotData = {
    dmNotes: "The artifact is cursed and corrupts its holder",
    sharedWithPlayers: "A powerful artifact has been stolen",
    status: PlotStatus.InProgress,
    urgency: Urgency.TimeSensitive,
  };

  const defaultLocationAsset: CampaignAsset = {
    id: defaultAssetId,
    campaignId: defaultCampaignId,
    name: "Dark Forest",
    recordType: RecordType.Location,
    summary: "A mysterious forest",
    playerSummary: "Known for disappearances",
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [],
    locationData: defaultLocationData,
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultEmbeddings = [0.1, 0.2, 0.3, 0.4, 0.5];

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockEmbedCampaignAsset = mock();
    const mockCreate = mock();
    const mockUpdate = mock();
    mockDBClient = {
      campaignAsset: {
        create: mockCreate,
        update: mockUpdate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./embedCampaignAsset", () => ({
      embedCampaignAsset: mockEmbedCampaignAsset,
    }));

    mock.module("../client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./create");
    createCampaignAsset = module.createCampaignAsset;

    // Configure default mock behavior AFTER import
    mockEmbedCampaignAsset.mockResolvedValue(defaultEmbeddings);
    mockDBClient.campaignAsset.create.mockResolvedValue(defaultLocationAsset);
    mockDBClient.campaignAsset.update.mockResolvedValue({
      ...defaultLocationAsset,
      Embeddings: defaultEmbeddings,
    });
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> createCampaignAsset creates a Location asset with embeddings", async () => {
    const input = {
      campaignId: defaultCampaignId,
      name: "Dark Forest",
      recordType: RecordType.Location,
      summary: "A mysterious forest",
      playerSummary: "Known for disappearances",
      sessionEventLink: [],
      locationData: defaultLocationData,
    };

    const result = await createCampaignAsset(input);

    // Verify asset was created with correct data
    expect(mockDBClient.campaignAsset.create).toHaveBeenCalledWith({
      data: {
        campaignId: defaultCampaignId,
        name: "Dark Forest",
        recordType: RecordType.Location,
        summary: "A mysterious forest",
        playerSummary: "Known for disappearances",
        Embeddings: [],
        locationData: defaultLocationData,
      },
    });

    // Verify embeddings were generated
    expect(mockEmbedCampaignAsset).toHaveBeenCalledWith(defaultLocationAsset);

    // Verify asset was updated with embeddings
    expect(mockDBClient.campaignAsset.update).toHaveBeenCalledWith({
      where: { id: defaultAssetId },
      data: { Embeddings: defaultEmbeddings },
    });

    // Verify return value
    expect(result.Embeddings).toEqual(defaultEmbeddings);
  });

  test("Unit -> createCampaignAsset creates an NPC asset", async () => {
    const npcAsset: CampaignAsset = {
      ...defaultLocationAsset,
      name: "Elven Ranger",
      recordType: RecordType.NPC,
      locationData: null,
      npcData: defaultNPCData,
    };

    mockDBClient.campaignAsset.create.mockResolvedValue(npcAsset);
    mockDBClient.campaignAsset.update.mockResolvedValue({
      ...npcAsset,
      Embeddings: defaultEmbeddings,
    });

    const input = {
      campaignId: defaultCampaignId,
      name: "Elven Ranger",
      recordType: RecordType.NPC,
      summary: "A mysterious elf",
      playerSummary: "Helpful and trustworthy",
      sessionEventLink: [],
      npcData: defaultNPCData,
    };

    const result = await createCampaignAsset(input);

    expect(mockDBClient.campaignAsset.create).toHaveBeenCalledWith({
      data: {
        campaignId: defaultCampaignId,
        name: "Elven Ranger",
        recordType: RecordType.NPC,
        summary: "A mysterious elf",
        playerSummary: "Helpful and trustworthy",
        Embeddings: [],
        npcData: defaultNPCData,
      },
    });

    expect(result.recordType).toBe(RecordType.NPC);
    expect(result.npcData).toEqual(defaultNPCData);
  });

  test("Unit -> createCampaignAsset creates a Plot asset", async () => {
    const plotAsset: CampaignAsset = {
      ...defaultLocationAsset,
      name: "Missing Artifact",
      recordType: RecordType.Plot,
      locationData: null,
      plotData: {
        dmNotes: defaultPlotData.dmNotes,
        sharedWithPlayers: defaultPlotData.sharedWithPlayers,
        status: defaultPlotData.status,
        urgency: defaultPlotData.urgency,
      },
    };

    mockDBClient.campaignAsset.create.mockResolvedValue(plotAsset);
    mockDBClient.campaignAsset.update.mockResolvedValue({
      ...plotAsset,
      Embeddings: defaultEmbeddings,
    });

    const input = {
      campaignId: defaultCampaignId,
      name: "Missing Artifact",
      recordType: RecordType.Plot,
      summary: "A powerful artifact has been stolen",
      playerSummary: "The town is in uproar",
      sessionEventLink: [],
      plotData: defaultPlotData,
    };

    const result = await createCampaignAsset(input);

    expect(mockDBClient.campaignAsset.create).toHaveBeenCalledWith({
      data: {
        campaignId: defaultCampaignId,
        name: "Missing Artifact",
        recordType: RecordType.Plot,
        summary: "A powerful artifact has been stolen",
        playerSummary: "The town is in uproar",
        Embeddings: [],
        plotData: defaultPlotData,
      },
    });

    expect(result.recordType).toBe(RecordType.Plot);
    expect(result.plotData?.dmNotes).toEqual(defaultPlotData.dmNotes);
    expect(result.plotData?.status).toEqual(defaultPlotData.status);
  });

  test("Unit -> createCampaignAsset handles empty optional strings", async () => {
    const input = {
      campaignId: defaultCampaignId,
      name: "Simple Location",
      recordType: RecordType.Location,
      summary: "",
      playerSummary: "",
      sessionEventLink: [],
      locationData: defaultLocationData,
    };

    await createCampaignAsset(input);

    expect(mockDBClient.campaignAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        summary: null,
        playerSummary: null,
      }),
    });
  });

  test("Unit -> createCampaignAsset handles embedding generation failure", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const embeddingError = new Error("Embedding generation failed");
    mockEmbedCampaignAsset.mockRejectedValue(embeddingError);

    const input = {
      campaignId: defaultCampaignId,
      name: "Dark Forest",
      recordType: RecordType.Location,
      summary: "A mysterious forest",
      playerSummary: "Known for disappearances",
      sessionEventLink: [],
      locationData: defaultLocationData,
    };

    try {
      await expect(createCampaignAsset(input)).rejects.toThrow(
        "Embedding generation failed"
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createCampaignAsset validates input schema for Location", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
      name: "Test",
      recordType: RecordType.Location,
      summary: "",
      playerSummary: "",
      sessionEventLink: [],
      // Missing locationData - should fail validation
    } as const;

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(createCampaignAsset(invalidInput as any)).rejects.toThrow();
  });

  test("Unit -> createCampaignAsset validates input schema for NPC", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
      name: "Test NPC",
      recordType: RecordType.NPC,
      summary: "",
      playerSummary: "",
      sessionEventLink: [],
      // Missing npcData - should fail validation
    } as const;

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(createCampaignAsset(invalidInput as any)).rejects.toThrow();
  });

  test("Unit -> createCampaignAsset validates input schema for Plot", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
      name: "Test Plot",
      recordType: RecordType.Plot,
      summary: "",
      playerSummary: "",
      sessionEventLink: [],
      // Missing plotData - should fail validation
    } as const;

    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
    await expect(createCampaignAsset(invalidInput as any)).rejects.toThrow();
  });
});
