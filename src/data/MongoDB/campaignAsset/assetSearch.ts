import type { CampaignAsset, RecordType } from "@prisma/client";
import * as Sentry from "@sentry/bun";
import type { Document } from "mongodb";
import { z } from "zod";
import { ENV } from "../../../config/environment";
import { createEmbeddings } from "../../AI";
import { DBClient } from "../client";
import { SearchTimings } from "../saveSearchMetrics";
import { buildHybridSearchPipeline } from "./buildHybridSearchPipeline";
import { buildTextSearchPipeline } from "./buildTextSearchPipeline";
import { buildVectorSearchPipeline } from "./buildVectorSearchPipeline";
import { captureSearchMetrics } from "./captureSearchMetrics";
import { convertRawAssetToSearchResult } from "./convertRawAssetToSearchResult";
import { embeddingCache } from "./embeddingCache";
import { executeManualHybridSearchWithPayload } from "./executeManualHybridSearch";

const assetSearchSchema = z
  .object({
    query: z.string().optional().describe("Natural language search query"),
    keywords: z.string().optional().describe("Keywords for text search"),
    campaignId: z.string().describe("Campaign ID to search within"),
    recordType: z
      .enum(["NPC", "Location", "Plot"])
      .optional()
      .describe("Optional filter by asset type"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(10)
      .describe("Number of results to return"),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.7)
      .describe("Minimum similarity score"),
  })
  .refine((data) => data.query || data.keywords, {
    message: "Either 'query' or 'keywords' must be provided",
  });

export type AssetSearchInput = z.input<typeof assetSearchSchema>;

export type SearchMode =
  | "vector_only"
  | "text_only"
  | "manual_hybrid"
  | "hybrid";

// Omit Embeddings from search results since we don't project it (large array)
export interface AssetSearchResult
  extends Omit<CampaignAsset, "Embeddings" | "campaign" | "sessionEventData"> {
  score: number;
}

export interface AssetSearchPayload {
  assets: AssetSearchResult[];
  timings: SearchTimings;
  searchMode: SearchMode;
}

/**
 * Determines the search mode based on which inputs are provided
 */
function determineSearchMode(
  hasQuery: boolean,
  hasKeywords: boolean
): SearchMode {
  if (!hasQuery) return "text_only";
  if (!hasKeywords) return "vector_only";
  // Must opt in to use MongoDB's native hybrid search (not supported on M0 tier)
  if (ENV.HYBRID_SEARCH_METHOD === "mongo") return "hybrid";
  return "manual_hybrid";
}

/**
 * Searches campaign assets using vector, text, or hybrid search.
 * Supports three modes:
 * - Vector-only: Semantic search using embeddings (query only)
 * - Text-only: Keyword search using Atlas Search (keywords only)
 * - Hybrid: Combined vector + text using RRF (both query and keywords)
 *
 * @param input - Search parameters including query/keywords, campaignId, and optional filters
 * @returns Promise<AssetSearchPayload> - Array of matching campaign assets with similarity scores
 */
export async function searchCampaignAssets(
  input: AssetSearchInput,
  storeMetrics = true
): Promise<AssetSearchPayload> {
  const startTime = performance.now();
  const params = assetSearchSchema.parse(input);

  // Determine search mode based on inputs
  const searchMode = determineSearchMode(!!params.query, !!params.keywords);

  try {
    let pipeline: Document[];
    let queryEmbedding: number[] = [];

    // Timings
    let embeddingDuration = 0;
    let vectorSearchDuration = 0;
    let textSearchDuration = 0;
    let conversionDuration = 0;

    // 1. Generate Embeddings (Shared for vector_only and hybrid)
    if (searchMode !== "text_only") {
      const embeddingStart = performance.now();
      queryEmbedding = embeddingCache.get(params.query!) || [];
      if (!queryEmbedding.length) {
        queryEmbedding = await createEmbeddings(params.query!);
        if (queryEmbedding.length > 0) {
          embeddingCache.set(params.query!, queryEmbedding);
        }
      }
      embeddingDuration = performance.now() - embeddingStart;

      if (queryEmbedding.length === 0) {
        Sentry.captureMessage("Embedding generation returned empty array", {
          level: "error",
          extra: {
            reminder:
              "Check that the connection to the AI service is working, and that there is sufficient budget and available rate limits.",
            campaignId: params.campaignId,
            query: params.query,
          },
        });
        throw new Error("Failed to generate query embedding");
      }
    }

    // 2. Build Pipeline
    const pipelineParams = {
      campaignId: params.campaignId,
      recordType: params.recordType as RecordType | undefined,
      limit: params.limit,
      minScore: params.minScore,
    };

    switch (searchMode) {
      case "vector_only":
        pipeline = buildVectorSearchPipeline({
          ...pipelineParams,
          queryVector: queryEmbedding,
        });
        break;

      case "text_only":
        pipeline = buildTextSearchPipeline({
          ...pipelineParams,
          keywords: params.keywords!,
        });
        break;

      case "manual_hybrid": {
        // Use client-side RRF (works on M0 tier)
        const hybridPayload = await executeManualHybridSearchWithPayload(
          {
            ...pipelineParams,
            queryVector: queryEmbedding,
            keywords: params.keywords!,
          },
          embeddingDuration,
          startTime
        );

        // Capture metrics for manual hybrid search
        if (storeMetrics) {
          void (async () => {
            try {
              await captureSearchMetrics({
                searchInput: params,
                results: hybridPayload.assets,
                timings: hybridPayload.timings,
                searchMode: "manual_hybrid",
              });
            } catch (error) {
              console.error("Search metrics capture failed:", error);
            }
          })();
        }

        return hybridPayload;
      }

      case "hybrid": {
        // Use MongoDB's native $rankFusion (requires M10+ tier)
        pipeline = buildHybridSearchPipeline({
          ...pipelineParams,
          queryVector: queryEmbedding,
          keywords: params.keywords!,
        });
        break;
      }
    }

    // 3. Execute Pipeline (Shared)
    const searchStart = performance.now();
    const results = await DBClient.campaignAsset.aggregateRaw({ pipeline });
    const searchDuration = performance.now() - searchStart;

    // Distribute search duration based on mode
    if (searchMode === "vector_only") {
      vectorSearchDuration = searchDuration;
    } else if (searchMode === "text_only") {
      textSearchDuration = searchDuration;
    } else {
      // Hybrid
      vectorSearchDuration = searchDuration / 2;
      textSearchDuration = searchDuration / 2;
    }

    // 4. Convert Results (Shared)
    const conversionStart = performance.now();
    const searchResults = Array.isArray(results)
      ? results.map(convertRawAssetToSearchResult)
      : [];
    conversionDuration = performance.now() - conversionStart;

    // 5. Construct Payload
    const searchPayload: AssetSearchPayload = {
      assets: searchResults,
      searchMode,
      timings: {
        total: performance.now() - startTime,
        embedding: embeddingDuration,
        vectorSearch: vectorSearchDuration,
        textSearch: textSearchDuration,
        conversion: conversionDuration,
      },
    };

    // 6. Capture Metrics (Shared)
    if (storeMetrics) {
      // Capture metrics asynchronously (fire-and-forget)
      void (async () => {
        try {
          await captureSearchMetrics({
            searchInput: params,
            results: searchPayload.assets,
            timings: searchPayload.timings,
            searchMode,
          });
        } catch (error) {
          console.error("Search metrics capture failed:", error);
          // Never throw - metrics should not break search
        }
      })();
    }
    return searchPayload;
  } catch (error) {
    // Log detailed error information server-side for debugging
    console.error("Campaign asset search failed:", {
      campaignId: params.campaignId,
      searchMode,
      query: params.query,
      keywords: params.keywords,
      recordType: params.recordType,
      error,
    });

    // Throw a generic error to avoid exposing MongoDB/infrastructure details
    // The actual error details are logged above for server-side debugging
    throw new Error(
      "Failed to search campaign assets. Please try again or contact support if the issue persists."
    );
  }
}
