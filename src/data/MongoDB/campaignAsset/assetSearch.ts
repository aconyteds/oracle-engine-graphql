import type { CampaignAsset, RecordType } from "@prisma/client";
import type { Document } from "mongodb";
import { z } from "zod";
import { createEmbeddings } from "../../AI";
import { DBClient } from "../client";
import { SearchTimings } from "../saveSearchMetrics";
import { buildHybridSearchPipeline } from "./buildHybridSearchPipeline";
import { buildTextSearchPipeline } from "./buildTextSearchPipeline";
import { buildVectorSearchPipeline } from "./buildVectorSearchPipeline";
import { captureSearchMetrics } from "./captureSearchMetrics";

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

export type SearchMode = "vector_only" | "text_only" | "hybrid";

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
  if (hasQuery && hasKeywords) return "hybrid";
  if (hasKeywords) return "text_only";
  return "vector_only";
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
    let embeddingDuration = 0;
    let vectorSearchDuration = 0;
    let textSearchDuration = 0;

    const searchPayload: AssetSearchPayload = {
      assets: [],
      searchMode,
      timings: {
        total: 0,
        embedding: 0,
        vectorSearch: 0,
        textSearch: 0,
        conversion: 0,
      },
    };

    switch (searchMode) {
      case "vector_only": {
        // Generate query embedding
        const embeddingStart = performance.now();
        const queryEmbedding = await createEmbeddings(params.query!);
        embeddingDuration = performance.now() - embeddingStart;

        if (queryEmbedding.length === 0) {
          throw new Error("Failed to generate query embedding");
        }

        // Build and execute vector search pipeline
        pipeline = buildVectorSearchPipeline({
          queryVector: queryEmbedding,
          campaignId: params.campaignId,
          recordType: params.recordType as RecordType | undefined,
          limit: params.limit,
          minScore: params.minScore,
        });

        const vectorStart = performance.now();
        const results = await DBClient.campaignAsset.aggregateRaw({ pipeline });
        vectorSearchDuration = performance.now() - vectorStart;

        // Convert results
        const conversionStart = performance.now();
        const searchResults = Array.isArray(results)
          ? results.map(convertRawAssetToSearchResult)
          : [];
        const conversionDuration = performance.now() - conversionStart;

        searchPayload.assets = searchResults;
        searchPayload.timings = {
          total: performance.now() - startTime,
          embedding: embeddingDuration,
          vectorSearch: vectorSearchDuration,
          textSearch: 0,
          conversion: conversionDuration,
        };
        break;
      }

      case "text_only": {
        // Build and execute text search pipeline
        pipeline = buildTextSearchPipeline({
          keywords: params.keywords!,
          campaignId: params.campaignId,
          recordType: params.recordType as RecordType | undefined,
          limit: params.limit,
          minScore: params.minScore,
        });

        const textStart = performance.now();
        const results = await DBClient.campaignAsset.aggregateRaw({ pipeline });
        textSearchDuration = performance.now() - textStart;

        // Convert results
        const conversionStart = performance.now();
        const searchResults = Array.isArray(results)
          ? results.map(convertRawAssetToSearchResult)
          : [];
        const conversionDuration = performance.now() - conversionStart;

        searchPayload.assets = searchResults;
        searchPayload.timings = {
          total: performance.now() - startTime,
          embedding: 0,
          vectorSearch: 0,
          textSearch: textSearchDuration,
          conversion: conversionDuration,
        };
        break;
      }

      case "hybrid": {
        // Generate query embedding for vector component
        const embeddingStart = performance.now();
        const queryEmbedding = await createEmbeddings(params.query!);
        embeddingDuration = performance.now() - embeddingStart;

        if (queryEmbedding.length === 0) {
          throw new Error("Failed to generate query embedding");
        }

        // Build and execute hybrid search pipeline
        pipeline = buildHybridSearchPipeline({
          queryVector: queryEmbedding,
          keywords: params.keywords!,
          campaignId: params.campaignId,
          recordType: params.recordType as RecordType | undefined,
          limit: params.limit,
          minScore: params.minScore,
        });

        const hybridStart = performance.now();
        const results = await DBClient.campaignAsset.aggregateRaw({ pipeline });
        const hybridDuration = performance.now() - hybridStart;

        // For hybrid, track execution time in both vector and text
        vectorSearchDuration = hybridDuration / 2;
        textSearchDuration = hybridDuration / 2;

        // Convert results
        const conversionStart = performance.now();
        const searchResults = Array.isArray(results)
          ? results.map(convertRawAssetToSearchResult)
          : [];
        const conversionDuration = performance.now() - conversionStart;

        searchPayload.assets = searchResults;
        searchPayload.timings = {
          total: performance.now() - startTime,
          embedding: embeddingDuration,
          vectorSearch: vectorSearchDuration,
          textSearch: textSearchDuration,
          conversion: conversionDuration,
        };
        break;
      }
    }

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
    console.error("Search failed:", {
      campaignId: params.campaignId,
      searchMode,
      query: params.query,
      keywords: params.keywords,
      error,
    });
    throw new Error(
      `Search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Type definition for raw MongoDB BSON document returned from aggregateRaw.
 * MongoDB returns ObjectIds as { $oid: string } and Dates as { $date: string }.
 * This interface matches the exact structure from the Prisma schema.
 */
interface RawBSONAssetDocument {
  _id: { $oid: string };
  campaignId: { $oid: string };
  name: string;
  recordType: RecordType;
  gmSummary: string | null;
  gmNotes: string | null;
  playerSummary: string | null;
  playerNotes: string | null;
  createdAt: { $date: string };
  updatedAt: { $date: string };
  locationData: CampaignAsset["locationData"] | null;
  plotData: CampaignAsset["plotData"] | null;
  npcData: CampaignAsset["npcData"] | null;
  sessionEventLink: Array<{ $oid: string }>;
  score?: number;
}

/**
 * Converts a BSON ObjectId structure to a string.
 * @param oid - BSON ObjectId in format { $oid: "string" }
 * @returns The ObjectId as a string
 */
function convertObjectId(oid: { $oid: string }): string {
  return oid.$oid;
}

/**
 * Converts a BSON Date structure to a JavaScript Date.
 * @param date - BSON Date in format { $date: "ISO string" }
 * @returns JavaScript Date object
 */
function convertDate(date: { $date: string }): Date {
  return new Date(date.$date);
}

/**
 * Converts raw MongoDB BSON document from aggregateRaw to AssetSearchResult.
 * Explicitly handles known BSON types based on the Prisma schema definition.
 *
 * This function is intentionally NOT recursive - it only converts the specific
 * fields we know contain BSON types (ObjectIds and Dates). All other fields
 * are passed through unchanged.
 *
 * Fields requiring conversion:
 * - id, campaignId: ObjectId -> string
 * - createdAt, updatedAt: BSON Date -> JavaScript Date
 * - sessionEventLink: Array<ObjectId> -> string[]
 * - score: vectorScore/textScore/hybridScore -> unified score field
 *
 * Fields NOT requiring conversion (already correct types):
 * - name, recordType, gmSummary, gmNotes, playerSummary, playerNotes
 * - locationData (all string fields)
 * - npcData (all string fields)
 *
 * @param rawDoc - Raw MongoDB document with BSON types matching RawBSONAssetDocument
 * @returns AssetSearchResult with proper JavaScript types
 */
function convertRawAssetToSearchResult(rawDoc: Document): AssetSearchResult {
  const doc = rawDoc as unknown as RawBSONAssetDocument;

  return {
    // Convert ObjectIds to strings
    id: convertObjectId(doc._id),
    campaignId: convertObjectId(doc.campaignId),

    // Convert BSON Dates to JavaScript Dates
    createdAt: convertDate(doc.createdAt),
    updatedAt: convertDate(doc.updatedAt),

    // Convert ObjectId array to string array
    sessionEventLink: doc.sessionEventLink.map(convertObjectId),

    // Pass through primitive fields (no conversion needed)
    name: doc.name,
    recordType: doc.recordType,
    gmSummary: doc.gmSummary,
    gmNotes: doc.gmNotes,
    playerSummary: doc.playerSummary,
    playerNotes: doc.playerNotes,
    score: doc.score ?? 0,
    locationData: doc.locationData,
    npcData: doc.npcData,
    plotData: doc.plotData,
  };
}
