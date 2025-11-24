import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { RecordType } from "@prisma/client";
import type { Document } from "mongodb";
import type { AssetSearchResult } from "./assetSearch";

describe("searchCampaignAssets", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockDBClient: {
    campaignAsset: {
      aggregateRaw: ReturnType<typeof mock>;
    };
  };
  let mockCreateEmbeddings: ReturnType<typeof mock>;
  let searchCampaignAssets: typeof import("./assetSearch").searchCampaignAssets;

  // Default mock data - reusable across tests
  const defaultCampaignId = "507f1f77bcf86cd799439011";
  const defaultAssetId1 = "507f1f77bcf86cd799439012";
  const defaultAssetId2 = "507f1f77bcf86cd799439013";
  const defaultQuery = "mysterious forest with ancient ruins";

  const defaultQueryEmbedding = new Array(1536)
    .fill(0)
    .map((_, i) => i * 0.001);

  const defaultLocationResult: AssetSearchResult = {
    id: defaultAssetId1,
    campaignId: defaultCampaignId,
    name: "Dark Forest",
    recordType: RecordType.Location,
    summary: "A mysterious forest with ancient ruins",
    playerSummary: "Known for disappearances",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-03"),
    locationData: {
      imageUrl: "https://example.com/location.jpg",
      description: "A dark and mysterious forest with ancient ruins",
      condition: "Dense foliage",
      pointsOfInterest: "Ancient ruins in the center",
      characters: "Forest guardian",
      dmNotes: "Hidden treasure in ruins",
      sharedWithPlayers: "Strange disappearances reported",
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
    score: 0.95,
  };

  const defaultNPCResult: AssetSearchResult = {
    id: defaultAssetId2,
    campaignId: defaultCampaignId,
    name: "Elven Ranger",
    recordType: RecordType.NPC,
    summary: "A mysterious elf who guards the forest",
    playerSummary: "Helpful and trustworthy",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    locationData: null,
    npcData: {
      imageUrl: "https://example.com/npc.jpg",
      physicalDescription: "A tall elf with silver hair",
      motivation: "Protecting the ancient forest ruins",
      mannerisms: "Speaks softly",
      dmNotes: "Knows secrets of the ruins",
      sharedWithPlayers: "Seems trustworthy",
    },
    plotData: null,
    sessionEventLink: [],
    score: 0.82,
  };

  const defaultResults = [defaultLocationResult, defaultNPCResult];

  // Raw MongoDB BSON format as returned by aggregateRaw
  const defaultRawResults = [
    {
      _id: { $oid: defaultAssetId1 },
      id: { $oid: defaultAssetId1 },
      campaignId: { $oid: defaultCampaignId },
      name: "Dark Forest",
      recordType: RecordType.Location,
      summary: "A mysterious forest with ancient ruins",
      playerSummary: "Known for disappearances",
      createdAt: { $date: "2024-01-01T00:00:00.000Z" },
      updatedAt: { $date: "2024-01-03T00:00:00.000Z" },
      locationData: {
        imageUrl: "https://example.com/location.jpg",
        description: "A dark and mysterious forest with ancient ruins",
        condition: "Dense foliage",
        pointsOfInterest: "Ancient ruins in the center",
        characters: "Forest guardian",
        dmNotes: "Hidden treasure in ruins",
        sharedWithPlayers: "Strange disappearances reported",
      },
      plotData: null,
      npcData: null,
      sessionEventLink: [],
      vectorScore: 0.95,
    },
    {
      _id: { $oid: defaultAssetId2 },
      id: { $oid: defaultAssetId2 },
      campaignId: { $oid: defaultCampaignId },
      name: "Elven Ranger",
      recordType: RecordType.NPC,
      summary: "A mysterious elf who guards the forest",
      playerSummary: "Helpful and trustworthy",
      createdAt: { $date: "2024-01-02T00:00:00.000Z" },
      updatedAt: { $date: "2024-01-02T00:00:00.000Z" },
      locationData: null,
      npcData: {
        imageUrl: "https://example.com/npc.jpg",
        physicalDescription: "A tall elf with silver hair",
        motivation: "Protecting the ancient forest ruins",
        mannerisms: "Speaks softly",
        dmNotes: "Knows secrets of the ruins",
        sharedWithPlayers: "Seems trustworthy",
      },
      plotData: null,
      sessionEventLink: [],
      vectorScore: 0.82,
    },
  ];

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    const mockAggregateRaw = mock();
    mockDBClient = {
      campaignAsset: {
        aggregateRaw: mockAggregateRaw,
      },
    };

    mockCreateEmbeddings = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("../client", () => ({
      DBClient: mockDBClient,
      RecordType: RecordType, // Re-export RecordType from @prisma/client
    }));

    mock.module("../../AI/createEmbeddings", () => ({
      createEmbeddings: mockCreateEmbeddings,
    }));

    // Dynamically import the module under test
    const module = await import("./assetSearch");
    searchCampaignAssets = module.searchCampaignAssets;

    // Configure default mock behavior AFTER import
    // aggregateRaw returns raw MongoDB BSON format, not JavaScript objects
    mockDBClient.campaignAsset.aggregateRaw.mockResolvedValue(
      defaultRawResults
    );
    mockCreateEmbeddings.mockResolvedValue(defaultQueryEmbedding);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> searchCampaignAssets returns matching assets with scores", async () => {
    const result = await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
    });

    expect(mockCreateEmbeddings).toHaveBeenCalledWith(defaultQuery);
    expect(mockDBClient.campaignAsset.aggregateRaw).toHaveBeenCalled();

    expect(result.assets).toEqual(defaultResults);
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0].score).toBe(0.95);
    expect(result.assets[1].score).toBe(0.82);
    expect(result.timings).toBeDefined();
  });

  test("Unit -> searchCampaignAssets filters by campaignId in pipeline", async () => {
    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    // Check that pipeline includes campaignId filter
    const matchStage = pipeline.find((stage: Document) => stage.$match);
    expect(matchStage).toBeDefined();
    expect(matchStage?.$match?.campaignId).toEqual({ $oid: defaultCampaignId });
  });

  test("Unit -> searchCampaignAssets filters by recordType when provided", async () => {
    const result = await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      recordType: "Location",
    });

    expect(result.assets).toEqual(defaultResults);
    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    // Check that pipeline includes recordType filter
    const recordTypeMatch = pipeline.find(
      (stage: Document) => stage.$match && stage.$match.recordType
    );
    expect(recordTypeMatch).toBeDefined();
    expect(recordTypeMatch?.$match?.recordType).toBe(RecordType.Location);
  });

  test("Unit -> searchCampaignAssets respects custom limit", async () => {
    const customLimit = 5;

    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      limit: customLimit,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    // Check that pipeline includes limit stage
    const limitStage = pipeline.find((stage: Document) => stage.$limit);
    expect(limitStage).toBeDefined();
    expect(limitStage?.$limit).toBe(customLimit);
  });

  test("Unit -> searchCampaignAssets uses default limit when not provided", async () => {
    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    const limitStage = pipeline.find((stage: Document) => stage.$limit);
    expect(limitStage).toBeDefined();
    expect(limitStage?.$limit).toBe(10); // Default limit
  });

  test("Unit -> searchCampaignAssets respects custom minScore", async () => {
    const customMinScore = 0.9;

    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      minScore: customMinScore,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    // Check that pipeline includes minScore filter
    const matchStage = pipeline.find(
      (stage: Document) => stage.$match?.vectorScore
    );
    expect(matchStage).toBeDefined();
    expect(matchStage?.$match?.vectorScore).toEqual({ $gte: customMinScore });
  });

  test("Unit -> searchCampaignAssets uses default minScore when not provided", async () => {
    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    const matchStage = pipeline.find(
      (stage: Document) => stage.$match?.vectorScore
    );
    expect(matchStage).toBeDefined();
    expect(matchStage?.$match?.vectorScore).toEqual({ $gte: 0.7 }); // Default minScore
  });

  test("Unit -> searchCampaignAssets includes vector search stage with correct parameters", async () => {
    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      limit: 5,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    const vectorSearchStage = pipeline.find(
      (stage: Document) => stage.$vectorSearch
    );
    expect(vectorSearchStage).toBeDefined();
    expect(vectorSearchStage?.$vectorSearch?.index).toBe(
      "campaign_asset_vector_index"
    );
    expect(vectorSearchStage?.$vectorSearch?.path).toBe("Embeddings");
    expect(vectorSearchStage?.$vectorSearch?.queryVector).toEqual(
      defaultQueryEmbedding
    );
    expect(vectorSearchStage?.$vectorSearch?.numCandidates).toBe(50); // limit * 10
    expect(vectorSearchStage?.$vectorSearch?.limit).toBe(10); // limit * 2
  });

  test("Unit -> searchCampaignAssets returns empty array when no results found", async () => {
    mockDBClient.campaignAsset.aggregateRaw.mockResolvedValue([]);

    const result = await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
    });

    expect(result.assets).toEqual([]);
    expect(result.assets).toHaveLength(0);
  });

  test("Unit -> searchCampaignAssets throws error when embedding generation fails", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockCreateEmbeddings.mockResolvedValue([]);

    try {
      await expect(
        searchCampaignAssets({
          query: defaultQuery,
          campaignId: defaultCampaignId,
        })
      ).rejects.toThrow("Failed to generate query embedding");

      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets handles embedding service errors with console logging", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const embeddingError = new Error("OpenAI API error");
    mockCreateEmbeddings.mockRejectedValue(embeddingError);

    try {
      await expect(
        searchCampaignAssets({
          query: defaultQuery,
          campaignId: defaultCampaignId,
        })
      ).rejects.toThrow("Vector search failed");

      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets handles database errors with console logging", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const dbError = new Error("Database connection failed");
    mockDBClient.campaignAsset.aggregateRaw.mockRejectedValue(dbError);

    try {
      await expect(
        searchCampaignAssets({
          query: defaultQuery,
          campaignId: defaultCampaignId,
        })
      ).rejects.toThrow("Vector search failed: Database connection failed");

      expect(mockConsoleError).toHaveBeenCalledWith("Vector search failed:", {
        campaignId: defaultCampaignId,
        query: defaultQuery,
        error: dbError,
      });
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets handles very long queries", async () => {
    // Truncation is now handled by createEmbeddings internally
    const longQuery = "word ".repeat(12000);

    await searchCampaignAssets({
      query: longQuery,
      campaignId: defaultCampaignId,
    });

    // Should still call createEmbeddings with the full query
    expect(mockCreateEmbeddings).toHaveBeenCalledWith(longQuery);
    expect(mockDBClient.campaignAsset.aggregateRaw).toHaveBeenCalled();
  });

  test("Unit -> searchCampaignAssets validates query is required", async () => {
    const invalidInput = {
      campaignId: defaultCampaignId,
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      searchCampaignAssets(invalidInput as any)
    ).rejects.toThrow();
  });

  test("Unit -> searchCampaignAssets validates campaignId is required", async () => {
    const invalidInput = {
      query: defaultQuery,
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      searchCampaignAssets(invalidInput as any)
    ).rejects.toThrow();
  });

  test("Unit -> searchCampaignAssets validates recordType is valid enum", async () => {
    const invalidInput = {
      query: defaultQuery,
      campaignId: defaultCampaignId,
      recordType: "InvalidType",
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      searchCampaignAssets(invalidInput as any)
    ).rejects.toThrow();
  });

  test("Unit -> searchCampaignAssets validates limit is positive integer", async () => {
    const invalidInput = {
      query: defaultQuery,
      campaignId: defaultCampaignId,
      limit: -1,
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      searchCampaignAssets(invalidInput as any)
    ).rejects.toThrow();
  });

  test("Unit -> searchCampaignAssets validates minScore is between 0 and 1", async () => {
    const invalidInput = {
      query: defaultQuery,
      campaignId: defaultCampaignId,
      minScore: 1.5,
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      searchCampaignAssets(invalidInput as any)
    ).rejects.toThrow();
  });

  test("Unit -> searchCampaignAssets validates minScore is not negative", async () => {
    const invalidInput = {
      query: defaultQuery,
      campaignId: defaultCampaignId,
      minScore: -0.1,
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      searchCampaignAssets(invalidInput as any)
    ).rejects.toThrow();
  });

  test("Unit -> searchCampaignAssets handles empty query string", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockCreateEmbeddings.mockResolvedValue([]);

    try {
      await expect(
        searchCampaignAssets({
          query: "   ",
          campaignId: defaultCampaignId,
        })
      ).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets combines all filters correctly", async () => {
    await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      recordType: "NPC",
      limit: 3,
      minScore: 0.8,
    });

    const callArgs = mockDBClient.campaignAsset.aggregateRaw.mock.calls[0][0];
    const pipeline = callArgs.pipeline;

    // Verify all filters are present
    const campaignMatch = pipeline.find(
      (stage: Document) => stage.$match?.campaignId
    );
    expect(campaignMatch?.$match?.campaignId).toEqual({
      $oid: defaultCampaignId,
    });

    const scoreMatch = pipeline.find(
      (stage: Document) => stage.$match?.vectorScore
    );
    expect(scoreMatch?.$match?.vectorScore).toEqual({ $gte: 0.8 });

    const recordTypeMatch = pipeline.find(
      (stage: Document) => stage.$match?.recordType
    );
    expect(recordTypeMatch?.$match?.recordType).toBe(RecordType.NPC);

    const limitStage = pipeline.find((stage: Document) => stage.$limit);
    expect(limitStage?.$limit).toBe(3);
  });

  test("Unit -> searchCampaignAssets calls captureSearchMetrics with timing data", async () => {
    // Mock the dynamic import of captureSearchMetrics
    const mockCaptureSearchMetrics = mock();
    mock.module("./captureSearchMetrics", () => ({
      captureSearchMetrics: mockCaptureSearchMetrics,
    }));

    const result = await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      limit: 10,
      minScore: 0.7,
    });

    expect(result.assets).toEqual(defaultResults);
    expect(result.timings).toBeDefined();

    // Wait for async metrics capture to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify captureSearchMetrics was NOT called (it's called by resolver, not this function)
    expect(mockCaptureSearchMetrics).toHaveBeenCalledTimes(0);
  });

  test("Unit -> searchCampaignAssets does not call metrics on error", async () => {
    const mockCaptureSearchMetrics = mock();
    mock.module("./captureSearchMetrics", () => ({
      captureSearchMetrics: mockCaptureSearchMetrics,
    }));

    const testError = new Error("Embedding failed");
    mockCreateEmbeddings.mockRejectedValue(testError);

    await expect(
      searchCampaignAssets({
        query: defaultQuery,
        campaignId: defaultCampaignId,
      })
    ).rejects.toThrow("Vector search failed");
  });

  test("Unit -> searchCampaignAssets continues even if metrics capture fails", async () => {
    const mockCaptureSearchMetrics = mock(() => {
      throw new Error("Metrics error");
    });
    const mockConsoleError = mock();
    const originalConsoleError = console.error;
    console.error = mockConsoleError;

    mock.module("./captureSearchMetrics", () => ({
      captureSearchMetrics: mockCaptureSearchMetrics,
    }));

    try {
      const result = await searchCampaignAssets({
        query: defaultQuery,
        campaignId: defaultCampaignId,
      });

      // Search should succeed - metrics are not called by this function
      expect(result.assets).toEqual(defaultResults);
      expect(result.timings).toBeDefined();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets passes recordTypeFilter to metrics", async () => {
    const mockCaptureSearchMetrics = mock();
    mock.module("./captureSearchMetrics", () => ({
      captureSearchMetrics: mockCaptureSearchMetrics,
    }));

    const result = await searchCampaignAssets({
      query: defaultQuery,
      campaignId: defaultCampaignId,
      recordType: "Location",
    });

    expect(result.assets).toEqual(defaultResults);
  });
});
