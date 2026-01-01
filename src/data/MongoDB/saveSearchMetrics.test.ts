import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { SaveSearchMetricsParams } from "./saveSearchMetrics";

describe("saveSearchMetrics", () => {
  // Declare mock variables with 'let'
  let mockCreate: ReturnType<typeof mock>;
  let mockDBClient: {
    searchMetric: {
      create: ReturnType<typeof mock>;
    };
  };
  let saveSearchMetrics: typeof import("./saveSearchMetrics").saveSearchMetrics;

  // Default mock data
  const defaultTimings = {
    total: 150,
    embedding: 50,
    vectorSearch: 75,
    textSearch: 0,
    conversion: 25,
  };

  const defaultInput: SaveSearchMetricsParams = {
    searchType: "campaign_asset_search",
    searchMode: "vector_only",
    query: "find the old wizard in the tower", // Length: 32
    campaignId: "campaign-123",
    limit: 10,
    minScore: 0.7,
    resultScores: [0.95, 0.88],
    expandedResultScores: null,
    timings: defaultTimings,
    totalItemCount: null,
  };

  const defaultCreatedMetric = {
    id: "metric-123",
    createdAt: new Date(),
    searchType: "campaign_asset_search",
    campaignId: "campaign-123",
    hasResults: true,
    resultCount: 2,
    requestedLimit: 10,
    minScore: 0.7,
    executionTimeMs: 150,
    embeddingTimeMs: 50,
    vectorTimeMs: 75,
    conversionTimeMs: 25,
    query: "",
    queryLength: 32,
    sampled: false,
    precisionAtK: null,
    recallAtK: null,
    f1AtK: null,
    precisionAt200: null,
    recallAt200: null,
    f1At200: null,
    coverageRatio: null,
    scoreMean: null,
    scoreMedian: null,
    scoreMin: null,
    scoreMax: null,
    scoreStdDev: null,
    totalAssets: null,
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCreate = mock();

    mockDBClient = {
      searchMetric: {
        create: mockCreate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./client", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./saveSearchMetrics");
    saveSearchMetrics = module.saveSearchMetrics;

    // Configure default mock behavior AFTER import
    mockCreate.mockResolvedValue(defaultCreatedMetric);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> saveSearchMetrics saves basic metrics when not sampled", async () => {
    await saveSearchMetrics(defaultInput);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      searchType: "campaign_asset_search",
      campaignId: "campaign-123",
      hasResults: true,
      resultCount: 2,
      requestedLimit: 10,
      minScore: 0.7,
      executionTimeMs: 150,
      embeddingTimeMs: 50,
      vectorTimeMs: 75,
      conversionTimeMs: 25,
      query: "",
      queryLength: 32,
      sampled: false,
      precisionAtK: null,
      recallAtK: null,
      f1AtK: null,
      precisionAt200: null,
      recallAt200: null,
      f1At200: null,
      coverageRatio: null,
      scoreMean: null,
      scoreMedian: null,
      scoreMin: null,
      scoreMax: null,
      scoreStdDev: null,
      totalAssets: null,
    });
  });

  test("Unit -> saveSearchMetrics saves sampled metrics when sampled", async () => {
    const sampledInput: SaveSearchMetricsParams = {
      ...defaultInput,
      expandedResultScores: [0.95, 0.88, 0.82, 0.75],
      totalItemCount: 100,
    };

    await saveSearchMetrics(sampledInput);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      searchType: "campaign_asset_search",
      campaignId: "campaign-123",
      hasResults: true,
      resultCount: 2,
      requestedLimit: 10,
      minScore: 0.7,
      executionTimeMs: 150,
      embeddingTimeMs: 50,
      vectorTimeMs: 75,
      conversionTimeMs: 25,
      query: "find the old wizard in the tower",
      queryLength: 32,
      sampled: true,
    });

    // Verify sampled metrics are calculated and saved (not null)
    expect(createCall.data.precisionAtK).not.toBeNull();
    expect(createCall.data.recallAtK).not.toBeNull();
    expect(createCall.data.f1AtK).not.toBeNull();
    expect(createCall.data.precisionAt200).not.toBeNull();
    expect(createCall.data.recallAt200).not.toBeNull();
    expect(createCall.data.f1At200).not.toBeNull();
    expect(createCall.data.coverageRatio).not.toBeNull();
    expect(createCall.data.scoreMean).not.toBeNull();
    expect(createCall.data.scoreMedian).not.toBeNull();
    expect(createCall.data.scoreMin).not.toBeNull();
    expect(createCall.data.scoreMax).not.toBeNull();
    expect(createCall.data.scoreStdDev).not.toBeNull();
    expect(createCall.data.totalAssets).toBe(100);
  });

  test("Unit -> saveSearchMetrics handles empty results", async () => {
    const inputWithNoResults: SaveSearchMetricsParams = {
      ...defaultInput,
      resultScores: [],
    };

    await saveSearchMetrics(inputWithNoResults);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      hasResults: false,
      resultCount: 0,
    });
  });

  test("Unit -> saveSearchMetrics handles database errors without throwing", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database connection failed");
    mockCreate.mockRejectedValue(testError);

    try {
      // Should not throw
      await expect(saveSearchMetrics(defaultInput)).resolves.toBeUndefined();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Search metrics save failed:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> saveSearchMetrics correctly calculates query length", async () => {
    const inputWithLongQuery: SaveSearchMetricsParams = {
      ...defaultInput,
      query: "a".repeat(500),
    };

    await saveSearchMetrics(inputWithLongQuery);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.queryLength).toBe(500);
  });

  test("Unit -> saveSearchMetrics stores empty string for query when not sampled", async () => {
    const inputWithSensitiveQuery: SaveSearchMetricsParams = {
      ...defaultInput,
      query: "find user with email john@example.com", // Length: 37
      expandedResultScores: null,
    };

    await saveSearchMetrics(inputWithSensitiveQuery);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.query).toBe("");
    expect(createCall.data.queryLength).toBe(37); // Still stores length
  });

  test("Unit -> saveSearchMetrics stores full query when sampled", async () => {
    const inputWithQuery: SaveSearchMetricsParams = {
      ...defaultInput,
      query: "find the ancient artifact",
      expandedResultScores: [0.95, 0.88, 0.82],
      totalItemCount: 50,
    };

    await saveSearchMetrics(inputWithQuery);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.query).toBe("find the ancient artifact");
    expect(createCall.data.sampled).toBe(true);
  });

  test("Unit -> saveSearchMetrics handles custom limit and minScore", async () => {
    const inputWithCustomParams: SaveSearchMetricsParams = {
      ...defaultInput,
      limit: 25,
      minScore: 0.85,
    };

    await saveSearchMetrics(inputWithCustomParams);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.requestedLimit).toBe(25);
    expect(createCall.data.minScore).toBe(0.85);
  });

  test("Unit -> saveSearchMetrics handles zero execution times", async () => {
    const inputWithZeroTimings: SaveSearchMetricsParams = {
      ...defaultInput,
      timings: {
        total: 0,
        embedding: 0,
        vectorSearch: 0,
        textSearch: 0,
        conversion: 0,
      },
    };

    await saveSearchMetrics(inputWithZeroTimings);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.executionTimeMs).toBe(0);
    expect(createCall.data.embeddingTimeMs).toBe(0);
    expect(createCall.data.vectorTimeMs).toBe(0);
    expect(createCall.data.conversionTimeMs).toBe(0);
  });

  test("Unit -> saveSearchMetrics handles missing query", async () => {
    const inputWithoutQuery: SaveSearchMetricsParams = {
      ...defaultInput,
      query: undefined,
    };

    await saveSearchMetrics(inputWithoutQuery);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.query).toBe("");
    expect(createCall.data.queryLength).toBe(0);
  });

  test("Unit -> saveSearchMetrics handles sampled request with all metrics", async () => {
    const sampledInput: SaveSearchMetricsParams = {
      searchType: "campaign_asset_search",
      searchMode: "vector_only",
      query: "test query",
      campaignId: "campaign-123",
      limit: 10,
      minScore: 0.7,
      resultScores: [0.95, 0.88, 0.85],
      expandedResultScores: [0.95, 0.88, 0.85, 0.8, 0.75],
      timings: defaultTimings,
      totalItemCount: 100,
    };

    await saveSearchMetrics(sampledInput);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.sampled).toBe(true);
    expect(createCall.data.query).toBe("test query");
    expect(createCall.data.totalAssets).toBe(100);
    expect(createCall.data.resultCount).toBe(3);
  });
});
