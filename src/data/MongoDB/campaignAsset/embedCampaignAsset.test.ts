import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { CampaignAsset } from "../client";

describe("embedCampaignAsset", () => {
  let mockCreateEmbeddings: ReturnType<typeof mock>;
  let embedCampaignAsset: typeof import("./embedCampaignAsset").embedCampaignAsset;

  // Default mock data
  const defaultEmbeddings = [0.1, 0.2, 0.3, 0.4, 0.5];

  const defaultNPCAsset: CampaignAsset = {
    id: "asset-1",
    campaignId: "campaign-1",
    name: "Gandalf",
    recordType: "NPC",
    summary: "A wise wizard",
    playerSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [],
    locationData: null,
    plotData: null,
    npcData: {
      imageUrl: "https://example.com/gandalf.jpg",
      physicalDescription: "Tall wizard with grey beard",
      motivation: "Protect Middle Earth",
      mannerisms: "Speaks in riddles",
      dmNotes: "Very powerful",
      sharedWithPlayers: "Known ally",
    },
    sessionEventLink: [],
  };

  const defaultLocationAsset: CampaignAsset = {
    id: "asset-2",
    campaignId: "campaign-1",
    name: "Rivendell",
    recordType: "Location",
    summary: "Elven sanctuary",
    playerSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [],
    locationData: {
      imageUrl: "https://example.com/rivendell.jpg",
      description: "Hidden valley of the elves",
      condition: "Pristine and magical",
      pointsOfInterest: "Council chamber, healing halls",
      characters: "Elrond, Arwen",
      dmNotes: "Safe haven",
      sharedWithPlayers: "Known to all",
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultPlotAsset: CampaignAsset = {
    id: "asset-3",
    campaignId: "campaign-1",
    name: "Destroy the Ring",
    recordType: "Plot",
    summary: "The quest to destroy the One Ring",
    playerSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    Embeddings: [],
    locationData: null,
    plotData: {
      dmNotes: "Journey to Mount Doom to destroy the One Ring",
      sharedWithPlayers: "Secret mission",
      status: "InProgress",
      urgency: "Critical",
      relatedAssetList: ["npc-1", "location-1"],
      relatedAssets: [
        {
          relatedAssetId: "npc-1",
          relationshipSummary: "Frodo carries the ring",
        },
        {
          relatedAssetId: "location-1",
          relationshipSummary: "Must reach Mount Doom",
        },
      ],
    },
    npcData: null,
    sessionEventLink: [],
  };

  beforeEach(async () => {
    mock.restore();

    mockCreateEmbeddings = mock();

    // Mock the createEmbeddings function from the AI module
    mock.module("../../AI/createEmbeddings", () => ({
      createEmbeddings: mockCreateEmbeddings,
    }));

    const module = await import("./embedCampaignAsset");
    embedCampaignAsset = module.embedCampaignAsset;

    mockCreateEmbeddings.mockResolvedValue(defaultEmbeddings);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> embedCampaignAsset generates embeddings for NPC asset", async () => {
    const result = await embedCampaignAsset(defaultNPCAsset);

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Name: Gandalf")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Summary: A wise wizard")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining(
        "Physical Description: Tall wizard with grey beard"
      )
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Motivation: Protect Middle Earth")
    );

    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset generates embeddings for Location asset", async () => {
    const result = await embedCampaignAsset(defaultLocationAsset);

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Name: Rivendell")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Description: Hidden valley of the elves")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining(
        "Points of Interest: Council chamber, healing halls"
      )
    );

    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset generates embeddings for Plot asset", async () => {
    const result = await embedCampaignAsset(defaultPlotAsset);

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Name: Destroy the Ring")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Summary: The quest to destroy the One Ring")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Status: InProgress")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Urgency: Critical")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Related Assets: Frodo carries the ring")
    );

    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset handles empty text content", async () => {
    const emptyAsset: CampaignAsset = {
      ...defaultNPCAsset,
      name: "",
      summary: null,
      npcData: null,
    };

    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await embedCampaignAsset(emptyAsset);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "No text content found for embedding"
      );
      expect(result).toEqual([]);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> embedCampaignAsset handles API errors gracefully", async () => {
    const testError = new Error("OpenAI API error");
    mockCreateEmbeddings.mockRejectedValue(testError);

    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await embedCampaignAsset(defaultNPCAsset);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error generating embeddings for campaign asset:",
        testError
      );
      expect(result).toEqual([]);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> embedCampaignAsset handles NPC with partial data", async () => {
    const partialNPC: CampaignAsset = {
      ...defaultNPCAsset,
      npcData: {
        imageUrl: "https://example.com/image.jpg",
        physicalDescription: "A warrior",
        motivation: "",
        mannerisms: "",
        dmNotes: "",
        sharedWithPlayers: "",
      },
    };

    const result = await embedCampaignAsset(partialNPC);

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Physical Description: A warrior")
    );
    expect(mockCreateEmbeddings).not.toHaveBeenCalledWith(
      expect.stringContaining("Motivation:")
    );
    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset handles Location with partial data", async () => {
    const partialLocation: CampaignAsset = {
      ...defaultLocationAsset,
      locationData: {
        imageUrl: "https://example.com/image.jpg",
        description: "A tavern",
        condition: "",
        pointsOfInterest: "",
        characters: "",
        dmNotes: "",
        sharedWithPlayers: "",
      },
    };

    const result = await embedCampaignAsset(partialLocation);

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Description: A tavern")
    );
    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset handles Plot with no related assets", async () => {
    const plotWithoutRelations: CampaignAsset = {
      ...defaultPlotAsset,
      plotData: {
        dmNotes: "A simple quest",
        sharedWithPlayers: "Secret mission",
        status: "InProgress",
        urgency: "Ongoing",
        relatedAssetList: [],
        relatedAssets: [],
      },
    };

    const result = await embedCampaignAsset(plotWithoutRelations);

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Status: InProgress")
    );
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(
      expect.stringContaining("Urgency: Ongoing")
    );
    expect(mockCreateEmbeddings).not.toHaveBeenCalledWith(
      expect.stringContaining("Related Assets:")
    );
    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset handles very long text", async () => {
    // Create a very long text - truncation is now handled by createEmbeddings
    const longText = "word ".repeat(12000);
    const assetWithLongText: CampaignAsset = {
      ...defaultNPCAsset,
      summary: longText,
    };

    const result = await embedCampaignAsset(assetWithLongText);

    // Should still call createEmbeddings with the full extracted text
    expect(mockCreateEmbeddings).toHaveBeenCalled();
    const calledText = mockCreateEmbeddings.mock.calls[0][0] as string;

    // Verify the extracted text contains the summary
    expect(calledText).toContain("Summary:");

    // Should return embeddings (truncation handled by createEmbeddings)
    expect(result).toEqual(defaultEmbeddings);
  });
});
