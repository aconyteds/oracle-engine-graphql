import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AssetSearchInput } from "./assetSearch";

describe("searchCampaignAssets error handling", () => {
  let mockAggregateRaw: ReturnType<typeof mock>;
  let mockCreateEmbeddings: ReturnType<typeof mock>;
  let searchCampaignAssets: typeof import("./assetSearch").searchCampaignAssets;

  beforeEach(async () => {
    mock.restore();

    mockAggregateRaw = mock();
    mockCreateEmbeddings = mock();

    mock.module("../client", () => ({
      DBClient: {
        campaignAsset: {
          aggregateRaw: mockAggregateRaw,
        },
      },
    }));

    mock.module("../../AI", () => ({
      createEmbeddings: mockCreateEmbeddings,
    }));

    const module = await import("./assetSearch");
    searchCampaignAssets = module.searchCampaignAssets;
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> searchCampaignAssets sanitizes MongoDB errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    // Simulate MongoDB $rankFusion error
    const mongoError = new Error(
      "PlanExecutor error during aggregation :: caused by :: $rankFusion stage not supported in MongoDB version 6.0"
    );
    mockCreateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
    mockAggregateRaw.mockRejectedValue(mongoError);

    const input: AssetSearchInput = {
      campaignId: "campaign-123",
      query: "test query",
      keywords: "test",
      limit: 10,
      minScore: 0.7,
    };

    try {
      await expect(searchCampaignAssets(input, false)).rejects.toThrow(
        "Failed to search campaign assets. Please try again or contact support if the issue persists."
      );

      // Verify error was logged server-side with details
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Campaign asset search failed:",
        expect.objectContaining({
          campaignId: "campaign-123",
          searchMode: "hybrid",
          query: "test query",
          keywords: "test",
        })
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets sanitizes vector search errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const vectorError = new Error(
      "Atlas Vector Search index 'campaign_asset_vector_index' not found on collection 'CampaignAsset'"
    );
    mockCreateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
    mockAggregateRaw.mockRejectedValue(vectorError);

    const input: AssetSearchInput = {
      campaignId: "campaign-123",
      query: "find the wizard",
      limit: 5,
      minScore: 0.8,
    };

    try {
      await expect(searchCampaignAssets(input, false)).rejects.toThrow(
        "Failed to search campaign assets. Please try again or contact support if the issue persists."
      );

      // Verify server-side logging includes search mode
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Campaign asset search failed:",
        expect.objectContaining({
          campaignId: "campaign-123",
          searchMode: "vector_only",
          query: "find the wizard",
        })
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets sanitizes text search errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const textSearchError = new Error(
      "Atlas Search index 'gm_asset_search' is not ready for queries"
    );
    mockAggregateRaw.mockRejectedValue(textSearchError);

    const input: AssetSearchInput = {
      campaignId: "campaign-123",
      keywords: "dragon tavern",
      recordType: "Location",
      limit: 10,
      minScore: 0.6,
    };

    try {
      await expect(searchCampaignAssets(input, false)).rejects.toThrow(
        "Failed to search campaign assets. Please try again or contact support if the issue persists."
      );

      // Verify recordType is logged for debugging
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Campaign asset search failed:",
        expect.objectContaining({
          campaignId: "campaign-123",
          searchMode: "text_only",
          keywords: "dragon tavern",
          recordType: "Location",
        })
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> searchCampaignAssets sanitizes authentication errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const authError = new Error(
      "MongoServerError: command find requires authentication"
    );
    mockCreateEmbeddings.mockResolvedValue([0.1, 0.2]);
    mockAggregateRaw.mockRejectedValue(authError);

    const input: AssetSearchInput = {
      campaignId: "campaign-123",
      query: "search query",
      limit: 10,
      minScore: 0.7,
    };

    try {
      const errorPromise = searchCampaignAssets(input, false);
      await expect(errorPromise).rejects.toThrow(
        "Failed to search campaign assets. Please try again or contact support if the issue persists."
      );

      // Error message should NOT contain "authentication" or MongoDB details
      await expect(errorPromise).rejects.not.toThrow(/authentication/i);
      await expect(errorPromise).rejects.not.toThrow(/MongoServerError/i);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
