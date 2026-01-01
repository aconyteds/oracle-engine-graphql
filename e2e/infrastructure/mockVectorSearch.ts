import type { RecordType } from "@prisma/client";
import type {
  AssetSearchPayload,
  AssetSearchResult,
} from "../../src/data/MongoDB/campaignAsset/assetSearch";

/**
 * Mock data for vector search results.
 * Maps query keywords to asset IDs and their similarity scores.
 */
export type MockSearchMapping = {
  query: string;
  results: Array<{
    assetId: string;
    score: number;
  }>;
};

/**
 * Creates a mock vector search function for testing.
 * Returns pre-defined results based on the query string.
 *
 * @param mockMappings - Array of query-to-results mappings
 * @param defaultAssets - Default assets to return when query doesn't match any mapping
 * @returns Mock function that simulates vectorSearchCampaignAssets
 */
export function createMockVectorSearch(
  mockMappings: MockSearchMapping[],
  defaultAssets: AssetSearchResult[] = []
) {
  return async (input: {
    campaignId: string;
    query: string;
    recordType?: RecordType;
    limit?: number;
    minScore?: number;
  }): Promise<AssetSearchPayload> => {
    // Find matching mock mapping based on query
    const mapping = mockMappings.find((m) =>
      input.query.toLowerCase().includes(m.query.toLowerCase())
    );

    // If no mapping found, return default assets
    if (!mapping) {
      return {
        assets: applyFilters(defaultAssets, input),
        searchMode: "vector_only",
        timings: {
          total: 0,
          embedding: 0,
          vectorSearch: 0,
          textSearch: 0,
          conversion: 0,
        },
      };
    }

    // Map the mock results to full AssetSearchResult objects
    // Note: This assumes the assets exist in the database
    // In the workflow, we'll ensure assets are created with these IDs
    const results: AssetSearchResult[] = mapping.results.map((result) => ({
      id: result.assetId,
      campaignId: input.campaignId,
      name: `Mock Asset ${result.assetId}`,
      recordType: "Location" as RecordType,
      gmSummary: null,
      gmNotes: "",
      playerSummary: null,
      playerNotes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      locationData: null,
      npcData: null,
      plotData: null,
      sessionEventLink: [],
      score: result.score,
    }));

    return {
      assets: applyFilters(results, input),
      searchMode: "vector_only",
      timings: {
        total: 0,
        embedding: 0,
        vectorSearch: 0,
        textSearch: 0,
        conversion: 0,
      },
    };
  };
}

/**
 * Applies filters to search results (recordType, limit, minScore)
 */
function applyFilters(
  results: AssetSearchResult[],
  filters: {
    recordType?: RecordType;
    limit?: number;
    minScore?: number;
  }
): AssetSearchResult[] {
  let filtered = [...results];

  // Filter by recordType
  if (filters.recordType) {
    filtered = filtered.filter((r) => r.recordType === filters.recordType);
  }

  // Filter by minScore
  if (filters.minScore !== undefined && filters.minScore !== null) {
    const minScore = filters.minScore;
    filtered = filtered.filter((r) => r.score >= minScore);
  }

  // Sort by score descending
  filtered.sort((a, b) => b.score - a.score);

  // Apply limit
  if (filters.limit !== undefined && filters.limit !== null) {
    filtered = filtered.slice(0, filters.limit);
  }

  return filtered;
}
