import type {
  CampaignAsset,
  Plot,
  PlotRelationship,
  RecordType,
} from "@prisma/client";
import type { Document } from "mongodb";
import { z } from "zod";
import { createEmbeddings } from "../../AI";
import { DBClient } from "../client";
import { SearchTimings } from "../saveSearchMetrics";

const assetSearchSchema = z.object({
  query: z.string().describe("Natural language search query"),
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
});

export type AssetSearchInput = z.input<typeof assetSearchSchema>;

// Omit Embeddings from search results since we don't project it (large array)
export interface AssetSearchResult
  extends Omit<CampaignAsset, "Embeddings" | "campaign" | "sessionEventData"> {
  score: number;
}

export interface AssetSearchPayload {
  assets: AssetSearchResult[];
  timings: SearchTimings;
}

/**
 * Searches campaign assets using vector similarity search with MongoDB Atlas Vector Search.
 * Converts the search query to embeddings and finds the most similar campaign assets.
 *
 * @param input - Search parameters including query string, campaignId, and optional filters
 * @returns Promise<AssetSearchResult[]> - Array of matching campaign assets with similarity scores
 */
export async function searchCampaignAssets(
  input: AssetSearchInput
): Promise<AssetSearchPayload> {
  const startTime = performance.now();
  const params = assetSearchSchema.parse(input);

  try {
    // Generate query embedding using same logic as asset embeddings
    const embeddingStart = performance.now();
    const queryEmbedding = await createEmbeddings(params.query);
    const embeddingDuration = performance.now() - embeddingStart;

    if (queryEmbedding.length === 0) {
      throw new Error("Failed to generate query embedding");
    }

    // Build aggregation pipeline for Atlas Vector Search
    const pipeline = buildVectorSearchPipeline({
      queryVector: queryEmbedding,
      campaignId: params.campaignId,
      recordType: params.recordType as RecordType | undefined,
      limit: params.limit,
      minScore: params.minScore,
    });

    // Execute raw aggregation pipeline
    const vectorSearchStart = performance.now();
    const results = await DBClient.campaignAsset.aggregateRaw({
      pipeline,
    });
    const vectorSearchDuration = performance.now() - vectorSearchStart;

    // Convert raw MongoDB BSON objects to proper JavaScript types
    const conversionStart = performance.now();
    const searchResults = Array.isArray(results)
      ? results.map(convertRawAssetToSearchResult)
      : [];
    const conversionDuration = performance.now() - conversionStart;

    const totalDuration = performance.now() - startTime;

    return {
      assets: searchResults,
      timings: {
        total: totalDuration,
        embedding: embeddingDuration,
        vectorSearch: vectorSearchDuration,
        conversion: conversionDuration,
      },
    };
  } catch (error) {
    console.error("Vector search failed:", {
      campaignId: params.campaignId,
      query: params.query,
      error,
    });
    throw new Error(
      `Vector search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

type VectorSearchPipelineParams = {
  queryVector: number[];
  campaignId: string;
  recordType?: RecordType;
  limit: number;
  minScore: number;
};

/**
 * Builds a MongoDB aggregation pipeline for Atlas Vector Search.
 * Pipeline stages: vectorSearch -> addFields (score) -> match (filters) -> limit -> project
 *
 * @param params - Pipeline parameters including query vector and filters
 * @returns MongoDB aggregation pipeline array
 */
function buildVectorSearchPipeline({
  queryVector,
  campaignId,
  recordType,
  limit,
  minScore,
}: VectorSearchPipelineParams): Document[] {
  const pipeline: Document[] = [
    {
      $vectorSearch: {
        index: "campaign_asset_vector_index",
        path: "Embeddings",
        queryVector: queryVector,
        numCandidates: limit * 10, // Overquery for better results
        limit: limit * 2, // Get extra for filtering
      },
    },
    {
      $addFields: {
        vectorScore: { $meta: "vectorSearchScore" },
      },
    },
    {
      $match: {
        campaignId: { $oid: campaignId },
        vectorScore: { $gte: minScore },
      },
    },
  ];

  // Add recordType filter if specified
  if (recordType) {
    pipeline.push({
      $match: {
        recordType: recordType,
      },
    });
  }

  // Final limit and projection
  pipeline.push(
    { $limit: limit },
    {
      $project: {
        _id: 1,
        campaignId: 1,
        name: 1,
        recordType: 1,
        summary: 1,
        playerSummary: 1,
        createdAt: 1,
        updatedAt: 1,
        locationData: 1,
        plotData: 1,
        npcData: 1,
        sessionEventLink: 1,
        vectorScore: 1,
      },
    }
  );

  return pipeline;
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
  summary: string | null;
  playerSummary: string | null;
  createdAt: { $date: string };
  updatedAt: { $date: string };
  locationData: CampaignAsset["locationData"] | null;
  plotData: RawBSONPlotData | null;
  npcData: CampaignAsset["npcData"] | null;
  sessionEventLink: Array<{ $oid: string }>;
  vectorScore: number;
}

/**
 * Plot data contains ObjectId arrays that need conversion.
 * Based on the Plot type from Prisma schema.
 */
interface RawBSONPlotData {
  dmNotes: string;
  sharedWithPlayers: string;
  status: "Unknown" | "Rumored" | "InProgress" | "WillNotDo" | "Closed";
  urgency: "Ongoing" | "TimeSensitive" | "Critical" | "Resolved";
  relatedAssetList: Array<{ $oid: string }>;
  relatedAssets: Array<{
    relatedAssetId: { $oid: string };
    relationshipSummary: string;
  }>;
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
 * Converts raw Plot data with BSON ObjectIds to proper JavaScript types.
 * Only converts the ObjectId fields - all other fields pass through unchanged.
 *
 * @param rawPlot - Raw plot data from MongoDB with BSON ObjectIds
 * @returns Plot data with ObjectIds converted to strings
 */
function convertPlotData(rawPlot: RawBSONPlotData): Plot {
  let relatedAssets: PlotRelationship[] = [];
  let relatedAssetList: string[] = [];
  if (rawPlot.relatedAssets) {
    relatedAssets = rawPlot.relatedAssets.map((rel) => ({
      relatedAssetId: convertObjectId(rel.relatedAssetId),
      relationshipSummary: rel.relationshipSummary,
    }));
    relatedAssetList = rawPlot.relatedAssetList.map(convertObjectId);
  }

  return {
    dmNotes: rawPlot.dmNotes,
    sharedWithPlayers: rawPlot.sharedWithPlayers,
    status: rawPlot.status,
    urgency: rawPlot.urgency,
    relatedAssetList,
    relatedAssets,
  };
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
 * - plotData.relatedAssetList: Array<ObjectId> -> string[]
 * - plotData.relatedAssets[].relatedAssetId: ObjectId -> string
 *
 * Fields NOT requiring conversion (already correct types):
 * - name, recordType, summary, playerSummary, vectorScore
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
    summary: doc.summary,
    playerSummary: doc.playerSummary,
    score: doc.vectorScore,

    // LocationData and NPC have no BSON types - pass through
    locationData: doc.locationData,
    npcData: doc.npcData,

    // Plot data contains nested ObjectIds that need conversion
    plotData: doc.plotData ? convertPlotData(doc.plotData) : null,
  };
}
