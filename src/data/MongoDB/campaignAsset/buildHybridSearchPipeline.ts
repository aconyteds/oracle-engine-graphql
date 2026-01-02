import type { RecordType } from "@prisma/client";
import type { Document } from "mongodb";

export type HybridSearchPipelineParams = {
  queryVector: number[];
  keywords: string;
  campaignId: string;
  recordType?: RecordType;
  limit: number;
  minScore: number;
};

/**
 * Builds a MongoDB aggregation pipeline for Hybrid Search using Reciprocal Rank Fusion (RRF).
 * Combines vector search and text search results using MongoDB's $rankFusion operator.
 * Pipeline stages: rankFusion (vector + text) -> addFields (score + normalize) -> match (filters) -> limit -> project
 *
 * RRF Score Normalization:
 * - Raw RRF formula: 1 / (rank + k) where k=60 (default)
 * - Raw RRF range: 0.009 - 0.016 (very small)
 * - Normalized to 0-1 scale: (rawScore - minRRF) / (maxRRF - minRRF)
 * - Where maxRRF = 1/61 ≈ 0.0164 (top result)
 * - Where minRRF = 1/160 ≈ 0.00625 (rank 100)
 * - After normalization, scores match vector/text search scale (0-1)
 *
 * @param params - Pipeline parameters including query vector, keywords, and filters
 * @returns MongoDB aggregation pipeline array
 */
export function buildHybridSearchPipeline({
  queryVector,
  keywords,
  campaignId,
  recordType,
  limit,
  minScore,
}: HybridSearchPipelineParams): Document[] {
  const pipeline: Document[] = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            vectorSearch: [
              {
                $vectorSearch: {
                  index: "campaign_asset_vector_index",
                  path: "Embeddings",
                  queryVector: queryVector,
                  numCandidates: limit * 10,
                  limit: limit * 2,
                  filter: {
                    campaignId: { $oid: campaignId },
                  },
                },
              },
            ],
            textSearch: [
              {
                $search: {
                  index: "gm_asset_search",
                  compound: {
                    should: [
                      {
                        text: {
                          query: keywords,
                          path: "name",
                          score: { boost: { value: 5 } }, // 5x boost for name matches
                        },
                      },
                      {
                        text: {
                          query: keywords,
                          path: "gmSummary",
                          score: { boost: { value: 2 } }, // 2x boost for summary matches
                        },
                      },
                      {
                        text: {
                          query: keywords,
                          path: "gmNotes",
                          // No boost for notes (baseline score)
                        },
                      },
                    ],
                    filter: [
                      {
                        equals: {
                          path: "campaignId",
                          value: { $oid: campaignId },
                        },
                      },
                    ],
                  },
                },
              },
              { $limit: limit * 2 },
            ],
          },
        },
        combination: {
          weights: {
            vectorSearch: 0.5,
            textSearch: 0.5,
          },
        },
        scoreDetails: true,
      },
    },
    {
      $addFields: {
        rawRRFScore: { $meta: "score" },
      },
    },
    // Limit needs to be before normalization to be scalable on larger datasets
    { $limit: limit * 2 }, // Overquery for better results after filtering
    // Normalize RRF score to 0-1 range to match vector/text search scales
    {
      $addFields: {
        normalizedScore: {
          $divide: [
            {
              $subtract: [
                "$rawRRFScore",
                0.00625, // minRRF (rank 100: 1/160)
              ],
            },
            {
              $subtract: [
                0.0164, // maxRRF (rank 1: 1/61)
                0.00625, // minRRF
              ],
            },
          ],
        },
      },
    },
    // Clamp normalized score to 0-1 range (handle edge cases)
    {
      $addFields: {
        score: {
          $max: [
            0,
            {
              $min: [1, "$normalizedScore"],
            },
          ],
        },
      },
    },
    {
      $match: {
        // Now minScore works consistently across all search modes (0-1 scale)
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
