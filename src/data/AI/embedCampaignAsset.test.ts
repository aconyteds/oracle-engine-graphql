import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { CampaignAsset } from "../MongoDB";

describe("embedCampaignAsset", () => {
  let mockEmbedQuery: ReturnType<typeof mock>;
  let mockOpenAIEmbeddings: ReturnType<typeof mock>;
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

    mockEmbedQuery = mock();
    mockOpenAIEmbeddings = mock(() => ({
      embedQuery: mockEmbedQuery,
    }));

    // Mock @langchain/openai with both OpenAIEmbeddings and ChatOpenAI
    // ChatOpenAI is needed by other modules in the import chain
    mock.module("@langchain/openai", () => ({
      OpenAIEmbeddings: mockOpenAIEmbeddings,
      ChatOpenAI: mock(() => ({})),
    }));

    const module = await import("./embedCampaignAsset");
    embedCampaignAsset = module.embedCampaignAsset;

    mockEmbedQuery.mockResolvedValue(defaultEmbeddings);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> embedCampaignAsset generates embeddings for NPC asset", async () => {
    const result = await embedCampaignAsset(defaultNPCAsset);

    expect(mockOpenAIEmbeddings).toHaveBeenCalledWith({
      apiKey: process.env.OPENAI_API_KEY,
      model: "text-embedding-3-small",
    });

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Name: Gandalf")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Summary: A wise wizard")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        "Physical Description: Tall wizard with grey beard"
      )
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Motivation: Protect Middle Earth")
    );

    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset generates embeddings for Location asset", async () => {
    const result = await embedCampaignAsset(defaultLocationAsset);

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Name: Rivendell")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Description: Hidden valley of the elves")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        "Points of Interest: Council chamber, healing halls"
      )
    );

    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset generates embeddings for Plot asset", async () => {
    const result = await embedCampaignAsset(defaultPlotAsset);

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Name: Destroy the Ring")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Summary: The quest to destroy the One Ring")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Status: InProgress")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Urgency: Critical")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
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
    mockEmbedQuery.mockRejectedValue(testError);

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

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Physical Description: A warrior")
    );
    expect(mockEmbedQuery).not.toHaveBeenCalledWith(
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

    expect(mockEmbedQuery).toHaveBeenCalledWith(
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

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Status: InProgress")
    );
    expect(mockEmbedQuery).toHaveBeenCalledWith(
      expect.stringContaining("Urgency: Ongoing")
    );
    expect(mockEmbedQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("Related Assets:")
    );
    expect(result).toEqual(defaultEmbeddings);
  });

  test("Unit -> embedCampaignAsset truncates text exceeding context window", async () => {
    // Create a very long text that exceeds 8191 tokens
    // Average word is ~1.3 tokens, so ~12,000 words should exceed the limit
    const longText = "word ".repeat(12000);
    const assetWithLongText: CampaignAsset = {
      ...defaultNPCAsset,
      summary: longText,
    };

    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    try {
      const result = await embedCampaignAsset(assetWithLongText);

      // Should warn about truncation
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Text exceeds context window of 8191 tokens")
      );

      // Should still call embedQuery with truncated text
      expect(mockEmbedQuery).toHaveBeenCalled();
      const calledText = mockEmbedQuery.mock.calls[0][0] as string;

      // Truncated text should be shorter than original
      expect(calledText.length).toBeLessThan(longText.length + 100); // +100 for "Name:" and "Summary:" labels

      // Should return embeddings
      expect(result).toEqual(defaultEmbeddings);
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> embedCampaignAsset truncation preserves text integrity", async () => {
    // Create text with exactly 8200 tokens (just over the limit)
    // Using a predictable pattern to verify proper truncation
    const longText = "The quick brown fox jumps over the lazy dog. ".repeat(
      2500
    );
    const assetWithLongText: CampaignAsset = {
      ...defaultNPCAsset,
      name: "Test Asset",
      summary: longText,
      npcData: {
        ...defaultNPCAsset.npcData!,
        physicalDescription: "Additional text to push over limit",
      },
    };

    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    try {
      const result = await embedCampaignAsset(assetWithLongText);

      // Should warn about truncation
      expect(mockConsoleWarn).toHaveBeenCalled();

      // Should still process and return embeddings
      expect(mockEmbedQuery).toHaveBeenCalled();
      expect(result).toEqual(defaultEmbeddings);

      // Verify the truncated text is valid (not cut mid-word or corrupted)
      const calledText = mockEmbedQuery.mock.calls[0][0] as string;
      expect(calledText).toContain("Name: Test Asset");
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> embedCampaignAsset does not truncate text within context window", async () => {
    // Create text that's well under the limit (should not truncate)
    const normalText = "A normal sized description. ".repeat(100);
    const assetWithNormalText: CampaignAsset = {
      ...defaultNPCAsset,
      summary: normalText,
    };

    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    try {
      const result = await embedCampaignAsset(assetWithNormalText);

      // Should NOT warn about truncation
      expect(mockConsoleWarn).not.toHaveBeenCalled();

      // Should process normally
      expect(mockEmbedQuery).toHaveBeenCalled();
      expect(result).toEqual(defaultEmbeddings);
    } finally {
      console.warn = originalConsoleWarn;
    }
  });
});
