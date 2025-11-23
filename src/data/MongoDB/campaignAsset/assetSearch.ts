import type { CampaignAsset, RecordType } from "@prisma/client";
import type { Document } from "mongodb";
import { z } from "zod";
import { createEmbeddings } from "../../AI";
import { DBClient } from "../client";

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

export interface AssetSearchResult extends CampaignAsset {
  vectorScore: number;
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
): Promise<AssetSearchResult[]> {
  const params = assetSearchSchema.parse(input);

  try {
    // Generate query embedding using same logic as asset embeddings
    const queryEmbedding = await createEmbeddings(params.query);

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
    const results = await DBClient.campaignAsset.aggregateRaw({
      pipeline,
    });

    return results as unknown as AssetSearchResult[];
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
        id: "$_id",
        campaignId: 1,
        name: 1,
        recordType: 1,
        summary: 1,
        playerSummary: 1,
        createdAt: 1,
        updatedAt: 1,
        Embeddings: 1,
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
