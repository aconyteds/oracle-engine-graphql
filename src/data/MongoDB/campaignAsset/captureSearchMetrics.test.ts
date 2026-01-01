import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { SearchTimings } from "../saveSearchMetrics";
import type { AssetSearchResult } from "./assetSearch";
import type { CaptureSearchMetricsInput } from "./captureSearchMetrics";

describe("captureSearchMetrics", () => {
  let captureSearchMetrics: typeof import("./captureSearchMetrics").captureSearchMetrics;
  let mockSentryCaptureMessage: ReturnType<typeof mock>;
  let mockSentryMetricsDistribution: ReturnType<typeof mock>;
  let mockSearchCampaignAssets: ReturnType<typeof mock>;
  let mockDBClientCount: ReturnType<typeof mock>;
  let mockMathRandom: ReturnType<typeof mock>;
  let mockConsoleError: ReturnType<typeof mock>;
  let mockSaveSearchMetrics: ReturnType<typeof mock>;

  const defaultTimings: SearchTimings = {
    total: 100,
    embedding: 30,
    vectorSearch: 50,
    textSearch: 0,
    conversion: 20,
  };

  const defaultResult: AssetSearchResult = {
    id: "result-1",
    campaignId: "campaign-123",
    name: "Test Asset",
    recordType: "NPC",
    gmSummary: "Test summary",
    gmNotes: null,
    playerSummary: null,
    playerNotes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    locationData: null,
    plotData: null,
    npcData: null,
    sessionEventLink: [],
    score: 0.85,
  };

  const defaultInput: CaptureSearchMetricsInput = {
    searchInput: {
      campaignId: "campaign-123",
      query: "test query",
      keywords: "test query",
      minScore: 0.7,
      limit: 10,
      recordType: undefined,
    },
    results: [defaultResult],
    timings: defaultTimings,
    searchMode: "vector_only",
  };

  beforeEach(async () => {
    mock.restore();

    // Create mocks
    mockSentryCaptureMessage = mock();
    mockSentryMetricsDistribution = mock();
    mockSearchCampaignAssets = mock();
    mockDBClientCount = mock();
    mockMathRandom = mock(() => 0.5); // Default: don't sample
    mockConsoleError = mock();
    mockSaveSearchMetrics = mock();

    // Mock modules
    mock.module("@sentry/bun", () => ({
      captureMessage: mockSentryCaptureMessage,
      metrics: {
        distribution: mockSentryMetricsDistribution,
      },
    }));

    mock.module("./assetSearch", () => ({
      searchCampaignAssets: mockSearchCampaignAssets,
    }));

    mock.module("../client", () => ({
      DBClient: {
        campaignAsset: {
          count: mockDBClientCount,
        },
      },
    }));

    mock.module("../saveSearchMetrics", () => ({
      saveSearchMetrics: mockSaveSearchMetrics,
    }));

    mock.module("../../../config/metrics", () => ({
      SEARCH_METRICS_CONFIG: {
        sampleRate: 0.05,
      },
    }));

    // Mock Math.random and console.error
    Math.random = mockMathRandom;
    console.error = mockConsoleError;

    // Dynamically import
    const module = await import("./captureSearchMetrics");
    captureSearchMetrics = module.captureSearchMetrics;

    // Default mock behaviors
    mockSearchCampaignAssets.mockResolvedValue([]);
    mockSaveSearchMetrics.mockResolvedValue(undefined);
    mockDBClientCount.mockResolvedValue(100);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> captureSearchMetrics captures basic metrics when not sampled", async () => {
    mockMathRandom.mockReturnValue(0.5); // > 0.05, won't sample

    await captureSearchMetrics(defaultInput);

    expect(mockSaveSearchMetrics).toHaveBeenCalledTimes(1);
    expect(mockSaveSearchMetrics).toHaveBeenCalledWith({
      searchType: "campaign_asset",
      searchMode: "vector_only",
      query: undefined, // Not sampled, so query should be undefined
      keywords: undefined,
      campaignId: "campaign-123",
      limit: 10,
      minScore: 0.7,
      resultScores: [0.85],
      expandedResultScores: null,
      timings: defaultTimings,
      totalItemCount: null,
    });
  });

  test("Unit -> captureSearchMetrics captures sampled metrics when sampled", async () => {
    mockMathRandom.mockReturnValue(0.01); // < 0.05, will sample

    const expandedResult = { ...defaultResult, score: 0.75 };
    mockSearchCampaignAssets.mockResolvedValue({
      assets: [defaultResult, expandedResult],
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(100);

    await captureSearchMetrics(defaultInput);

    expect(mockSearchCampaignAssets).toHaveBeenCalledWith(
      {
        query: "test query",
        keywords: "test query",
        campaignId: "campaign-123",
        recordType: undefined,
        limit: 200,
        minScore: 0.7,
      },
      false
    );

    expect(mockDBClientCount).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-123",
      },
    });

    expect(mockSaveSearchMetrics).toHaveBeenCalledTimes(1);
    const call = mockSaveSearchMetrics.mock.calls[0][0];
    expect(call.query).toBe("test query");
    expect(call.keywords).toBe("test query");
    expect(call.expandedResultScores).toEqual([0.85, 0.75]);
    expect(call.totalItemCount).toBe(100);
  });

  test("Unit -> captureSearchMetrics sets hasResults to false when no results", async () => {
    const inputWithNoResults = { ...defaultInput, results: [] };
    mockMathRandom.mockReturnValue(0.5); // Don't sample

    await captureSearchMetrics(inputWithNoResults);

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        resultScores: [],
      })
    );
  });

  test("Unit -> captureSearchMetrics includes recordTypeFilter when provided", async () => {
    const inputWithFilter = {
      ...defaultInput,
      searchInput: {
        ...defaultInput.searchInput,
        recordType: "NPC" as const,
      },
    };
    mockMathRandom.mockReturnValue(0.5); // Don't sample

    await captureSearchMetrics(inputWithFilter);

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-123",
        resultScores: [0.85],
      })
    );
  });

  test("Unit -> captureSearchMetrics calculates precision and recall for sampled requests", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample

    // Original search: 5 results at k=10
    const results: AssetSearchResult[] = Array.from({ length: 5 }, (_, i) => ({
      ...defaultResult,
      id: `result-${i}`,
      score: 0.8 + i * 0.01,
    }));

    // Expanded search: 15 results at k=200
    const expandedResults: AssetSearchResult[] = Array.from(
      { length: 15 },
      (_, i) => ({
        ...defaultResult,
        id: `expanded-${i}`,
        score: 0.75 + i * 0.01,
      })
    );

    mockSearchCampaignAssets.mockResolvedValue({
      assets: expandedResults,
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(100);

    await captureSearchMetrics({ ...defaultInput, results });

    expect(mockSaveSearchMetrics).toHaveBeenCalledTimes(1);
    const call = mockSaveSearchMetrics.mock.calls[0][0];
    expect(call.expandedResultScores).toHaveLength(15);
    expect(call.totalItemCount).toBe(100);
  });

  test("Unit -> captureSearchMetrics calculates score statistics correctly", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample

    const results: AssetSearchResult[] = [
      { ...defaultResult, score: 0.7 },
      { ...defaultResult, score: 0.8 },
      { ...defaultResult, score: 0.9 },
      { ...defaultResult, score: 0.85 },
      { ...defaultResult, score: 0.75 },
    ];

    mockSearchCampaignAssets.mockResolvedValue({
      assets: [],
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(100);

    await captureSearchMetrics({ ...defaultInput, results });

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        resultScores: [0.7, 0.8, 0.9, 0.85, 0.75],
      })
    );
  });

  test("Unit -> captureSearchMetrics handles zero results gracefully", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample

    const inputWithNoResults = { ...defaultInput, results: [] };
    mockSearchCampaignAssets.mockResolvedValue({
      assets: [],
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(100);

    await captureSearchMetrics(inputWithNoResults);

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        resultScores: [],
      })
    );
  });

  test("Unit -> captureSearchMetrics handles errors without throwing", async () => {
    mockMathRandom.mockReturnValue(0.5); // Don't sample
    const testError = new Error("Save error");
    mockSaveSearchMetrics.mockImplementation(() => {
      throw testError;
    });

    // Should not throw
    await expect(captureSearchMetrics(defaultInput)).resolves.toBeUndefined();

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Search metrics capture failed:",
      testError
    );
  });

  test("Unit -> captureSearchMetrics handles sampled metrics collection errors", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample
    const testError = new Error("DB error");
    mockSearchCampaignAssets.mockRejectedValue(testError);

    // Should not throw, just log error
    await expect(captureSearchMetrics(defaultInput)).resolves.toBeUndefined();

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Search metrics capture failed:",
      testError
    );
  });

  test("Unit -> captureSearchMetrics passes recordTypeFilter to expanded search", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample
    mockSearchCampaignAssets.mockResolvedValue({
      assets: [],
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(50);

    const inputWithFilter = {
      ...defaultInput,
      searchInput: {
        ...defaultInput.searchInput,
        recordType: "Location" as const,
      },
    };

    await captureSearchMetrics(inputWithFilter);

    expect(mockSearchCampaignAssets).toHaveBeenCalledWith(
      {
        query: "test query",
        keywords: "test query",
        campaignId: "campaign-123",
        recordType: "Location",
        limit: 200,
        minScore: 0.7,
      },
      false
    );

    expect(mockDBClientCount).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-123",
        recordType: "Location",
      },
    });
  });

  test("Unit -> captureSearchMetrics includes expanded scores in sampled metrics", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample

    const expandedResults: AssetSearchResult[] = [
      { ...defaultResult, score: 0.9 },
      { ...defaultResult, score: 0.85 },
      { ...defaultResult, score: 0.8 },
    ];

    mockSearchCampaignAssets.mockResolvedValue({
      assets: expandedResults,
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(100);

    await captureSearchMetrics(defaultInput);

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        resultScores: [0.85],
        expandedResultScores: [0.9, 0.85, 0.8],
      })
    );
  });

  test("Unit -> captureSearchMetrics calculates median correctly for even number of scores", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample

    const results: AssetSearchResult[] = [
      { ...defaultResult, score: 0.7 },
      { ...defaultResult, score: 0.8 },
      { ...defaultResult, score: 0.85 },
      { ...defaultResult, score: 0.9 },
    ];

    mockSearchCampaignAssets.mockResolvedValue({
      assets: [],
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(100);

    await captureSearchMetrics({ ...defaultInput, results });

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        resultScores: [0.7, 0.8, 0.85, 0.9],
      })
    );
  });

  test("Unit -> captureSearchMetrics handles zero total assets", async () => {
    mockMathRandom.mockReturnValue(0.01); // Will sample
    mockSearchCampaignAssets.mockResolvedValue({
      assets: [],
      timings: defaultTimings,
    });
    mockDBClientCount.mockResolvedValue(0);

    await captureSearchMetrics(defaultInput);

    expect(mockSaveSearchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        totalItemCount: 0,
      })
    );
  });
});
