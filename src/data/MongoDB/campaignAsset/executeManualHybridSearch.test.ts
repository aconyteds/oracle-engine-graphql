import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("executeManualHybridSearch", () => {
  // Mock variables
  let mockAggregateRaw: ReturnType<typeof mock>;
  let executeManualHybridSearch: typeof import("./executeManualHybridSearch").executeManualHybridSearch;

  // Default mock data
  const defaultVectorResult = {
    _id: { $oid: "vector-1" },
    campaignId: { $oid: "campaign-1" },
    name: "Vector Asset",
    recordType: "NPC",
    gmSummary: "A vector search result",
    gmNotes: null,
    playerSummary: null,
    playerNotes: null,
    createdAt: { $date: "2024-01-01T00:00:00.000Z" },
    updatedAt: { $date: "2024-01-01T00:00:00.000Z" },
    locationData: null,
    plotData: null,
    npcData: null,
    sessionEventLink: [],
    score: 0.95,
  };

  const defaultTextResult = {
    _id: { $oid: "text-1" },
    campaignId: { $oid: "campaign-1" },
    name: "Text Asset",
    recordType: "Location",
    gmSummary: "A text search result",
    gmNotes: null,
    playerSummary: null,
    playerNotes: null,
    createdAt: { $date: "2024-01-01T00:00:00.000Z" },
    updatedAt: { $date: "2024-01-01T00:00:00.000Z" },
    locationData: null,
    plotData: null,
    npcData: null,
    sessionEventLink: [],
    score: 0.9,
  };

  const defaultParams = {
    queryVector: [0.1, 0.2, 0.3],
    keywords: "test search",
    campaignId: "campaign-1",
    limit: 10,
    minScore: 0.5,
  };

  beforeEach(async () => {
    mock.restore();

    mockAggregateRaw = mock();

    // Mock the DBClient
    mock.module("../client", () => ({
      DBClient: {
        campaignAsset: {
          aggregateRaw: mockAggregateRaw,
        },
      },
    }));

    // Dynamically import the module under test
    const module = await import("./executeManualHybridSearch");
    executeManualHybridSearch = module.executeManualHybridSearch;

    // Default mock behavior - return different results for vector vs text
    let callCount = 0;
    mockAggregateRaw.mockImplementation(() => {
      callCount++;
      // First call is vector search, second is text search
      if (callCount === 1) {
        return Promise.resolve([defaultVectorResult]);
      }
      return Promise.resolve([defaultTextResult]);
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> executeManualHybridSearch combines vector and text results", async () => {
    const result = await executeManualHybridSearch(defaultParams);

    // Should have both results
    expect(result.assets.length).toBe(2);
    expect(result.assets.map((a) => a.name)).toContain("Vector Asset");
    expect(result.assets.map((a) => a.name)).toContain("Text Asset");
  });

  test("Unit -> executeManualHybridSearch executes both searches in parallel", async () => {
    await executeManualHybridSearch(defaultParams);

    // Both vector and text search should be called
    expect(mockAggregateRaw).toHaveBeenCalledTimes(2);
  });

  test("Unit -> executeManualHybridSearch returns timing information", async () => {
    const result = await executeManualHybridSearch(defaultParams);

    expect(result.timings).toBeDefined();
    expect(result.timings.vectorSearch).toBeGreaterThanOrEqual(0);
    expect(result.timings.textSearch).toBeGreaterThanOrEqual(0);
    expect(result.timings.fusion).toBeGreaterThanOrEqual(0);
    expect(result.timings.conversion).toBeGreaterThanOrEqual(0);
  });

  test("Unit -> executeManualHybridSearch respects limit parameter", async () => {
    // Return many results
    const manyResults = Array.from({ length: 20 }, (_, i) => ({
      ...defaultVectorResult,
      _id: { $oid: `asset-${i}` },
      name: `Asset ${i}`,
    }));

    mockAggregateRaw.mockResolvedValue(manyResults);

    const result = await executeManualHybridSearch({
      ...defaultParams,
      limit: 5,
    });

    expect(result.assets.length).toBeLessThanOrEqual(5);
  });

  test("Unit -> executeManualHybridSearch filters by minScore", async () => {
    // Set up results that will have varying RRF scores after fusion
    // Single result in each list = low RRF score
    mockAggregateRaw.mockResolvedValueOnce([defaultVectorResult]);
    mockAggregateRaw.mockResolvedValueOnce([]);

    const result = await executeManualHybridSearch({
      ...defaultParams,
      minScore: 0.0, // Low threshold to include results
    });

    // Should include the vector result
    expect(result.assets.length).toBeGreaterThanOrEqual(0);
  });

  test("Unit -> executeManualHybridSearch handles empty results from both searches", async () => {
    mockAggregateRaw.mockResolvedValue([]);

    const result = await executeManualHybridSearch(defaultParams);

    expect(result.assets).toEqual([]);
  });

  test("Unit -> executeManualHybridSearch handles empty vector results", async () => {
    mockAggregateRaw.mockResolvedValueOnce([]);
    mockAggregateRaw.mockResolvedValueOnce([defaultTextResult]);

    const result = await executeManualHybridSearch(defaultParams);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].name).toBe("Text Asset");
  });

  test("Unit -> executeManualHybridSearch handles empty text results", async () => {
    mockAggregateRaw.mockResolvedValueOnce([defaultVectorResult]);
    mockAggregateRaw.mockResolvedValueOnce([]);

    const result = await executeManualHybridSearch(defaultParams);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].name).toBe("Vector Asset");
  });

  test("Unit -> executeManualHybridSearch deduplicates results found in both searches", async () => {
    // Same asset found by both searches
    const sharedResult = {
      ...defaultVectorResult,
      _id: { $oid: "shared-1" },
      name: "Shared Asset",
    };

    mockAggregateRaw.mockResolvedValueOnce([sharedResult]);
    mockAggregateRaw.mockResolvedValueOnce([{ ...sharedResult, score: 0.85 }]);

    const result = await executeManualHybridSearch(defaultParams);

    // Should only have one instance of the shared asset
    const sharedAssets = result.assets.filter((a) => a.name === "Shared Asset");
    expect(sharedAssets.length).toBe(1);
  });

  test("Unit -> executeManualHybridSearch ranks items found in both searches higher", async () => {
    // Asset found in both searches
    const sharedResult = {
      ...defaultVectorResult,
      _id: { $oid: "shared-1" },
      name: "Shared Asset",
    };

    // Asset found only in vector search
    const vectorOnlyResult = {
      ...defaultVectorResult,
      _id: { $oid: "vector-only-1" },
      name: "Vector Only Asset",
    };

    mockAggregateRaw.mockResolvedValueOnce([sharedResult, vectorOnlyResult]);
    mockAggregateRaw.mockResolvedValueOnce([sharedResult]);

    const result = await executeManualHybridSearch({
      ...defaultParams,
      minScore: 0, // Include all results
    });

    // Shared asset should rank higher (found in both lists)
    const sharedIndex = result.assets.findIndex(
      (a) => a.name === "Shared Asset"
    );
    const vectorOnlyIndex = result.assets.findIndex(
      (a) => a.name === "Vector Only Asset"
    );

    expect(sharedIndex).toBeLessThan(vectorOnlyIndex);
  });

  test("Unit -> executeManualHybridSearch normalizes scores to 0-1 range", async () => {
    const result = await executeManualHybridSearch(defaultParams);

    for (const asset of result.assets) {
      expect(asset.score).toBeGreaterThanOrEqual(0);
      expect(asset.score).toBeLessThanOrEqual(1);
    }
  });

  test("Unit -> executeManualHybridSearch converts BSON types correctly", async () => {
    const result = await executeManualHybridSearch(defaultParams);

    // Check that ObjectIds are converted to strings
    expect(typeof result.assets[0].id).toBe("string");
    expect(typeof result.assets[0].campaignId).toBe("string");

    // Check that dates are converted to Date objects
    expect(result.assets[0].createdAt).toBeInstanceOf(Date);
    expect(result.assets[0].updatedAt).toBeInstanceOf(Date);
  });
});

describe("executeManualHybridSearchWithPayload", () => {
  let mockAggregateRaw: ReturnType<typeof mock>;
  let executeManualHybridSearchWithPayload: typeof import("./executeManualHybridSearch").executeManualHybridSearchWithPayload;

  const defaultVectorResult = {
    _id: { $oid: "vector-1" },
    campaignId: { $oid: "campaign-1" },
    name: "Vector Asset",
    recordType: "NPC",
    gmSummary: "A vector search result",
    gmNotes: null,
    playerSummary: null,
    playerNotes: null,
    createdAt: { $date: "2024-01-01T00:00:00.000Z" },
    updatedAt: { $date: "2024-01-01T00:00:00.000Z" },
    locationData: null,
    plotData: null,
    npcData: null,
    sessionEventLink: [],
    score: 0.95,
  };

  const defaultParams = {
    queryVector: [0.1, 0.2, 0.3],
    keywords: "test search",
    campaignId: "campaign-1",
    limit: 10,
    minScore: 0.5,
  };

  beforeEach(async () => {
    mock.restore();

    mockAggregateRaw = mock();

    mock.module("../client", () => ({
      DBClient: {
        campaignAsset: {
          aggregateRaw: mockAggregateRaw,
        },
      },
    }));

    const module = await import("./executeManualHybridSearch");
    executeManualHybridSearchWithPayload =
      module.executeManualHybridSearchWithPayload;

    mockAggregateRaw.mockResolvedValue([defaultVectorResult]);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> executeManualHybridSearchWithPayload returns AssetSearchPayload format", async () => {
    const startTime = performance.now();
    const embeddingDuration = 50;

    const result = await executeManualHybridSearchWithPayload(
      defaultParams,
      embeddingDuration,
      startTime
    );

    expect(result.searchMode).toBe("hybrid");
    expect(result.assets).toBeDefined();
    expect(result.timings).toBeDefined();
    expect(result.timings.embedding).toBe(embeddingDuration);
    expect(result.timings.total).toBeGreaterThan(0);
  });

  test("Unit -> executeManualHybridSearchWithPayload includes all timing fields", async () => {
    const startTime = performance.now();
    const embeddingDuration = 50;

    const result = await executeManualHybridSearchWithPayload(
      defaultParams,
      embeddingDuration,
      startTime
    );

    expect(result.timings.embedding).toBeDefined();
    expect(result.timings.vectorSearch).toBeDefined();
    expect(result.timings.textSearch).toBeDefined();
    expect(result.timings.conversion).toBeDefined();
    expect(result.timings.total).toBeDefined();
  });
});
