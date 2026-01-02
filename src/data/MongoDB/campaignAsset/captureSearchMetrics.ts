import { SEARCH_METRICS_CONFIG } from "../../../config/metrics";
import { DBClient } from "../client";
import { SearchTimings, saveSearchMetrics } from "../saveSearchMetrics";
import type {
  AssetSearchInput,
  AssetSearchResult,
  SearchMode,
} from "./assetSearch";
import { searchCampaignAssets } from "./assetSearch";

/**
 * Input parameters for metrics capture.
 * Combines the original search input with results and timing data.
 */
export interface CaptureSearchMetricsInput {
  searchInput: AssetSearchInput;
  results: AssetSearchResult[];
  timings: SearchTimings;
  searchMode: SearchMode;
}

/**
 * Basic metrics captured for every search request
 */
interface BasicMetrics {
  campaignId: string;
  hasResults: boolean;
  resultCount: number;
  requestedLimit: number;
  minScore: number;
  executionTimeMs: number;
  embeddingTimeMs: number;
  vectorSearchTimeMs: number;
  conversionTimeMs: number;
  queryLength: number;
  recordTypeFilter: string | null;
}

/**
 * Captures search metrics to Sentry for monitoring and analysis.
 * Metrics are captured asynchronously and should not affect search performance.
 *
 * Basic metrics are captured for every search request:
 * - Hit/no-hit status
 * - Result counts
 * - Execution timings
 *
 * Sampled metrics are captured based on SEARCH_METRICS_SAMPLE_RATE:
 * - Full query text
 * - Precision and recall at k and 200
 * - Score distributions
 * - Coverage ratios
 *
 * @param input - Search parameters and results to capture metrics for
 */
export async function captureSearchMetrics(
  input: CaptureSearchMetricsInput
): Promise<void> {
  try {
    // Determine if this request should be sampled
    const shouldSample = Math.random() < SEARCH_METRICS_CONFIG.sampleRate;

    // Defensive check for undefined results
    if (!input.results || !Array.isArray(input.results)) {
      console.warn("captureSearchMetrics received invalid results", input);
      return;
    }

    // Always collect basic metrics
    const basicMetrics: BasicMetrics = {
      campaignId: input.searchInput.campaignId,
      hasResults: input.results.length > 0,
      resultCount: input.results.length,
      requestedLimit: input.searchInput.limit ?? 10,
      minScore: input.searchInput.minScore ?? 0.7,
      executionTimeMs: input.timings.total,
      embeddingTimeMs: input.timings.embedding,
      vectorSearchTimeMs: input.timings.vectorSearch,
      conversionTimeMs: input.timings.conversion,
      queryLength: input.searchInput.query?.length ?? 0,
      recordTypeFilter: input.searchInput.recordType ?? null,
    };

    // Conditionally collect sampled metrics
    let expandedResultScores: number[] | null = null;
    let totalItemCount: number | null = null;
    if (shouldSample) {
      // Execute expanded search with same parameters but limit=200
      const { assets: expandedResults } = await searchCampaignAssets(
        {
          ...input.searchInput,
          limit: 200,
        },
        // Don't store these metrics, that would potentially cause an infinite loop
        false
      );
      expandedResultScores = expandedResults.map((r) => r.score);
      totalItemCount = await DBClient.campaignAsset.count({
        where: {
          campaignId: input.searchInput.campaignId,
          ...(input.searchInput.recordType && {
            recordType: input.searchInput.recordType,
          }),
        },
      });
    }

    // Save metrics to MongoDB
    await saveSearchMetrics({
      searchType: "campaign_asset",
      searchMode: input.searchMode,
      query: shouldSample ? input.searchInput.query : undefined,
      keywords: shouldSample ? input.searchInput.keywords : undefined,
      campaignId: basicMetrics.campaignId,
      limit: basicMetrics.requestedLimit,
      minScore: basicMetrics.minScore,
      resultScores: input.results.map((r) => r.score),
      expandedResultScores: expandedResultScores,
      timings: input.timings,
      totalItemCount,
    });
  } catch (error) {
    // Metrics capture should never throw or affect search functionality
    console.error("Search metrics capture failed:", error);
  }
}
