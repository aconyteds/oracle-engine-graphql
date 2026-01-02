import type { RecordType } from "@prisma/client";
import type { Document } from "mongodb";

export type VectorSearchPipelineParams = {
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
export function buildVectorSearchPipeline({
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
        filter: {
          // We only want assets from the specific campaign
          campaignId: { $oid: campaignId },
        },
      },
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" },
      },
    },
    {
      $match: {
        score: { $gte: minScore },
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
        gmSummary: 1,
        gmNotes: 1,
        playerSummary: 1,
        playerNotes: 1,
        createdAt: 1,
        updatedAt: 1,
        locationData: 1,
        plotData: 1,
        npcData: 1,
        sessionEventLink: 1,
        score: 1,
      },
    }
  );

  return pipeline;
}
