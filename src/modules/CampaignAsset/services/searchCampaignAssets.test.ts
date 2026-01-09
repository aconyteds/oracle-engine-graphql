import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("searchCampaignAssets service", () => {
  // Mock variables
  let mockSearchAssets: ReturnType<typeof mock>;
  let mockDetectQueryIntent: ReturnType<typeof mock>;
  let searchCampaignAssets: typeof import("./searchCampaignAssets").searchCampaignAssets;

  // Default mock data
  const defaultAsset = {
    id: "asset-1",
    campaignId: "campaign-1",
    name: "Test Asset",
    recordType: "NPC" as const,
    gmSummary: "A test asset",
    gmNotes: null,
    playerSummary: null,
    playerNotes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    sessionEventLink: [],
    locationData: null,
    npcData: null,
    plotData: null,
    score: 0.9,
  };

  const defaultSearchResult = {
    assets: [defaultAsset],
    timings: {
      total: 100,
      embedding: 50,
      vectorSearch: 30,
      textSearch: 0,
      conversion: 20,
    },
    searchMode: "vector_only" as const,
  };

  const defaultInput = {
    campaignId: "campaign-1",
    query: "test query",
    keywords: null,
    recordType: null,
    limit: null,
    minScore: null,
  };

  beforeEach(async () => {
    mock.restore();

    mockSearchAssets = mock();
    mockDetectQueryIntent = mock();

    // Mock the data layer
    mock.module("../../../data/MongoDB/campaignAsset", () => ({
      searchCampaignAssets: mockSearchAssets,
    }));

    // Mock detectQueryIntent
    mock.module("./detectQueryIntent", () => ({
      detectQueryIntent: mockDetectQueryIntent,
    }));

    // Dynamically import the module under test
    const module = await import("./searchCampaignAssets");
    searchCampaignAssets = module.searchCampaignAssets;

    // Default mock behavior
    mockSearchAssets.mockResolvedValue(defaultSearchResult);
    mockDetectQueryIntent.mockReturnValue("vector");
  });

  afterEach(() => {
    mock.restore();
  });

  describe("smart routing", () => {
    test("Unit -> searchCampaignAssets routes to text search when query equals keywords and looks like a name", async () => {
      mockDetectQueryIntent.mockReturnValue("text");

      const input = {
        ...defaultInput,
        query: "Gandalf",
        keywords: "Gandalf",
      };

      await searchCampaignAssets(input);

      // Should call searchAssets with only keywords (no query)
      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "campaign-1",
          keywords: "Gandalf",
        })
      );

      // Should NOT include query in the call
      const callArgs = mockSearchAssets.mock.calls[0][0];
      expect(callArgs.query).toBeUndefined();
    });

    test("Unit -> searchCampaignAssets routes to vector search when query equals keywords and looks descriptive", async () => {
      mockDetectQueryIntent.mockReturnValue("vector");

      const input = {
        ...defaultInput,
        query: "the wizard who lives in the tower",
        keywords: "the wizard who lives in the tower",
      };

      await searchCampaignAssets(input);

      // Should call searchAssets with only query (no keywords)
      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "campaign-1",
          query: "the wizard who lives in the tower",
        })
      );

      // Should NOT include keywords in the call
      const callArgs = mockSearchAssets.mock.calls[0][0];
      expect(callArgs.keywords).toBeUndefined();
    });

    test("Unit -> searchCampaignAssets does not apply smart routing when query and keywords differ", async () => {
      const input = {
        ...defaultInput,
        query: "fire mage",
        keywords: "Pyra",
      };

      await searchCampaignAssets(input);

      // Should call searchAssets with both query and keywords
      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "campaign-1",
          query: "fire mage",
          keywords: "Pyra",
        })
      );

      // detectQueryIntent should not be called
      expect(mockDetectQueryIntent).not.toHaveBeenCalled();
    });

    test("Unit -> searchCampaignAssets does not apply smart routing when only query is provided", async () => {
      const input = {
        ...defaultInput,
        query: "test query",
        keywords: null,
      };

      await searchCampaignAssets(input);

      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test query",
        })
      );

      // detectQueryIntent should not be called
      expect(mockDetectQueryIntent).not.toHaveBeenCalled();
    });

    test("Unit -> searchCampaignAssets does not apply smart routing when only keywords is provided", async () => {
      const input = {
        ...defaultInput,
        query: null,
        keywords: "test keywords",
      };

      await searchCampaignAssets(input);

      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: "test keywords",
        })
      );

      // detectQueryIntent should not be called
      expect(mockDetectQueryIntent).not.toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    test("Unit -> searchCampaignAssets throws InvalidInput when neither query nor keywords provided", async () => {
      const input = {
        ...defaultInput,
        query: null,
        keywords: null,
      };

      await expect(searchCampaignAssets(input)).rejects.toThrow(
        "At least one of 'query' or 'keywords' must be provided"
      );
    });
  });

  describe("parameter passing", () => {
    test("Unit -> searchCampaignAssets passes recordType when provided", async () => {
      const input = {
        ...defaultInput,
        recordType: "NPC" as const,
      };

      await searchCampaignAssets(input);

      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          recordType: "NPC",
        })
      );
    });

    test("Unit -> searchCampaignAssets passes limit when provided", async () => {
      const input = {
        ...defaultInput,
        limit: 5,
      };

      await searchCampaignAssets(input);

      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
        })
      );
    });

    test("Unit -> searchCampaignAssets passes minScore when provided", async () => {
      const input = {
        ...defaultInput,
        minScore: 0.8,
      };

      await searchCampaignAssets(input);

      expect(mockSearchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          minScore: 0.8,
        })
      );
    });
  });

  describe("result transformation", () => {
    test("Unit -> searchCampaignAssets transforms results correctly", async () => {
      const result = await searchCampaignAssets(defaultInput);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].score).toBe(0.9);
      expect(result.assets[0].asset).toBeDefined();
    });

    test("Unit -> searchCampaignAssets handles empty results", async () => {
      mockSearchAssets.mockResolvedValue({
        ...defaultSearchResult,
        assets: [],
      });

      const result = await searchCampaignAssets(defaultInput);

      expect(result.assets).toEqual([]);
    });
  });

  describe("error handling", () => {
    test("Unit -> searchCampaignAssets throws ServerError on search failure", async () => {
      mockSearchAssets.mockRejectedValue(new Error("Database error"));

      await expect(searchCampaignAssets(defaultInput)).rejects.toThrow(
        "An error occurred while searching campaign assets"
      );
    });
  });
});
