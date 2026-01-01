import type { RecordType } from "@prisma/client";
import { type Document } from "mongodb";

export type TextSearchPipelineParams = {
  keywords: string;
  campaignId: string;
  recordType?: RecordType;
  limit: number;
  minScore: number;
};

/**
 * Builds a MongoDB aggregation pipeline for Atlas Text Search with field boosting.
 * Pipeline stages: search -> addFields (score) -> limit -> addFields (normalize) -> match (filters) -> project
 *
 * Field Boosting Strategy:
 * - name: 5x boost (primary identifier, highest relevance)
 * - gmSummary: 2x boost (concise description, high relevance)
 * - gmNotes: 1x (baseline, detailed content)
 *
 * Text search scores are normalized to 0-1 range using asymptotic formula: score / (score + 1)
 *
 * @param params - Pipeline parameters including keywords and filters
 * @returns MongoDB aggregation pipeline array
 */
export function buildTextSearchPipeline({
  keywords,
  campaignId,
  recordType,
  limit,
  minScore,
}: TextSearchPipelineParams): Document[] {
  const pipeline: Document[] = [
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
          minimumShouldMatch: 1, // At least one field must match
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
    {
      $addFields: {
        textScore: { $meta: "searchScore" },
      },
    },
    // Limit needs to be before normalization to be scalable on larger datasets
    { $limit: limit * 2 }, // Overquery for better results after filtering
    // Normalize text score to 0-1 range using asymptotic normalization
    {
      $addFields: {
        normalizedScore: {
          $divide: ["$textScore", { $add: ["$textScore", 1] }],
        },
      },
    },
    {
      $match: {
        normalizedScore: { $gte: minScore },
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
        score: "$normalizedScore",
      },
    }
  );

  return pipeline;
}
