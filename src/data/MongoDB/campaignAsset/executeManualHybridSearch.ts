import type { RecordType } from "@prisma/client";
import type { Document } from "mongodb";
import { DBClient } from "../client";
import type { SearchTimings } from "../saveSearchMetrics";
import {
  applyReciprocalRankFusion,
  normalizeRRFScores,
} from "./applyReciprocalRankFusion";
import type { AssetSearchPayload, AssetSearchResult } from "./assetSearch";
import { buildTextSearchPipeline } from "./buildTextSearchPipeline";
import { buildVectorSearchPipeline } from "./buildVectorSearchPipeline";
import { convertRawAssetToSearchResult } from "./convertRawAssetToSearchResult";

export interface ManualHybridSearchParams {
  queryVector: number[];
  keywords: string;
  campaignId: string;
  recordType?: RecordType;
  limit: number;
  minScore: number;
}

export interface ManualHybridSearchTimings {
  vectorSearch: number;
  textSearch: number;
  fusion: number;
  conversion: number;
}

/**
 * Executes hybrid search using manual Reciprocal Rank Fusion (RRF).
 *
 * This approach runs vector and text searches as separate parallel queries,
 * then combines the results client-side using RRF. This works on MongoDB Atlas
 * M0 tier where $rankFusion is not available.
 *
 * Flow:
 * 1. Build vector and text search pipelines
 * 2. Execute both in parallel
 * 3. Convert raw BSON results to typed results
 * 4. Apply RRF to combine rankings
 * 5. Normalize scores to 0-1 range
 * 6. Filter by minScore and limit
 *
 * @param params - Search parameters including query vector, keywords, and filters
 * @returns Combined results with RRF-based scores and timing information
 */
export async function executeManualHybridSearch(
  params: ManualHybridSearchParams
): Promise<{
  assets: AssetSearchResult[];
  timings: ManualHybridSearchTimings;
}> {
  const { queryVector, keywords, campaignId, recordType, limit, minScore } =
    params;

  // Build pipelines for both searches
  // Use higher limits to get more candidates for RRF fusion
  const candidateLimit = limit * 3;

  const vectorPipeline = buildVectorSearchPipeline({
    queryVector,
    campaignId,
    recordType,
    limit: candidateLimit,
    minScore: 0, // Don't filter by minScore here - do it after RRF
  });

  const textPipeline = buildTextSearchPipeline({
    keywords,
    campaignId,
    recordType,
    limit: candidateLimit,
    minScore: 0, // Don't filter by minScore here - do it after RRF
  });

  // Execute both searches in parallel
  const vectorStart = performance.now();
  const textStart = performance.now();

  const [vectorRawResults, textRawResults] = await Promise.all([
    DBClient.campaignAsset.aggregateRaw({ pipeline: vectorPipeline }),
    DBClient.campaignAsset.aggregateRaw({ pipeline: textPipeline }),
  ]);

  const vectorDuration = performance.now() - vectorStart;
  const textDuration = performance.now() - textStart;

  // Convert raw BSON results to typed results
  const conversionStart = performance.now();
  const vectorResults: AssetSearchResult[] = Array.isArray(vectorRawResults)
    ? vectorRawResults.map((doc: Document) =>
        convertRawAssetToSearchResult(doc)
      )
    : [];

  const textResults: AssetSearchResult[] = Array.isArray(textRawResults)
    ? textRawResults.map((doc: Document) => convertRawAssetToSearchResult(doc))
    : [];
  const conversionDuration = performance.now() - conversionStart;

  // Apply RRF fusion
  const fusionStart = performance.now();
  const rrfResults = applyReciprocalRankFusion(vectorResults, textResults);

  // Normalize RRF scores to 0-1 range
  const normalizedResults = normalizeRRFScores(rrfResults);

  // Filter by minScore
  const filteredResults = normalizedResults.filter(
    (result) => result.score >= minScore
  );

  // Apply final limit
  const limitedResults = filteredResults.slice(0, limit);
  const fusionDuration = performance.now() - fusionStart;

  return {
    assets: limitedResults,
    timings: {
      vectorSearch: vectorDuration,
      textSearch: textDuration,
      fusion: fusionDuration,
      conversion: conversionDuration,
    },
  };
}

/**
 * Wraps manual hybrid search results in the standard AssetSearchPayload format.
 *
 * @param params - Search parameters
 * @param embeddingDuration - Time spent generating query embeddings
 * @param startTime - Overall search start time for total duration calculation
 * @returns AssetSearchPayload with timing and mode information
 */
export async function executeManualHybridSearchWithPayload(
  params: ManualHybridSearchParams,
  embeddingDuration: number,
  startTime: number
): Promise<AssetSearchPayload> {
  const { assets, timings } = await executeManualHybridSearch(params);

  const searchTimings: SearchTimings = {
    total: performance.now() - startTime,
    embedding: embeddingDuration,
    vectorSearch: timings.vectorSearch,
    textSearch: timings.textSearch,
    conversion: timings.conversion + timings.fusion, // Include fusion in conversion
  };

  return {
    assets,
    timings: searchTimings,
    searchMode: "hybrid",
  };
}
