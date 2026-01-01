import { describe, expect, test } from "bun:test";
import type { RecordType } from "@prisma/client";
import { buildVectorSearchPipeline } from "./buildVectorSearchPipeline";

describe("buildVectorSearchPipeline", () => {
  const defaultParams = {
    queryVector: [0.1, 0.2, 0.3],
    campaignId: "507f1f77bcf86cd799439011",
    limit: 5,
    minScore: 0.7,
  };

  test("Unit -> buildVectorSearchPipeline builds basic pipeline without recordType", () => {
    const pipeline = buildVectorSearchPipeline(defaultParams);

    expect(pipeline).toBeArray();
    expect(pipeline).toHaveLength(5);

    // Verify $vectorSearch stage
    expect(pipeline[0]).toHaveProperty("$vectorSearch");
    expect(pipeline[0].$vectorSearch).toEqual({
      index: "campaign_asset_vector_index",
      path: "Embeddings",
      queryVector: defaultParams.queryVector,
      numCandidates: 50, // limit * 10
      limit: 10, // limit * 2
      filter: {
        campaignId: { $oid: defaultParams.campaignId },
      },
    });

    // Verify $addFields stage
    expect(pipeline[1]).toHaveProperty("$addFields");
    expect(pipeline[1].$addFields).toEqual({
      score: { $meta: "vectorSearchScore" },
    });

    // Verify $match stage for score
    expect(pipeline[2]).toHaveProperty("$match");
    expect(pipeline[2].$match).toEqual({
      score: { $gte: defaultParams.minScore },
    });

    // Verify $limit stage
    expect(pipeline[3]).toHaveProperty("$limit");
    expect(pipeline[3].$limit).toBe(defaultParams.limit);

    // Verify $project stage
    expect(pipeline[4]).toHaveProperty("$project");
    expect(pipeline[4].$project).toHaveProperty("_id", 1);
    expect(pipeline[4].$project).toHaveProperty("campaignId", 1);
    expect(pipeline[4].$project).toHaveProperty("name", 1);
    expect(pipeline[4].$project).toHaveProperty("recordType", 1);
    expect(pipeline[4].$project).toHaveProperty("score", 1);
  });

  test("Unit -> buildVectorSearchPipeline includes recordType filter when provided", () => {
    const recordType: RecordType = "NPC";
    const pipeline = buildVectorSearchPipeline({
      ...defaultParams,
      recordType,
    });

    expect(pipeline).toHaveLength(6);

    // Verify recordType $match stage is inserted before limit
    expect(pipeline[3]).toHaveProperty("$match");
    expect(pipeline[3].$match).toEqual({
      recordType: "NPC",
    });

    // Verify $limit is now at index 4
    expect(pipeline[4]).toHaveProperty("$limit");
    expect(pipeline[4].$limit).toBe(defaultParams.limit);

    // Verify $project is now at index 5
    expect(pipeline[5]).toHaveProperty("$project");
  });

  test("Unit -> buildVectorSearchPipeline calculates numCandidates and limit multipliers correctly", () => {
    const customLimit = 10;
    const pipeline = buildVectorSearchPipeline({
      ...defaultParams,
      limit: customLimit,
    });

    expect(pipeline[0].$vectorSearch.numCandidates).toBe(100); // limit * 10
    expect(pipeline[0].$vectorSearch.limit).toBe(20); // limit * 2
    expect(pipeline[3].$limit).toBe(customLimit);
  });

  test("Unit -> buildVectorSearchPipeline handles different minScore values", () => {
    const customMinScore = 0.85;
    const pipeline = buildVectorSearchPipeline({
      ...defaultParams,
      minScore: customMinScore,
    });

    expect(pipeline[2].$match.score).toEqual({ $gte: customMinScore });
  });

  test("Unit -> buildVectorSearchPipeline handles different campaignId values", () => {
    const customCampaignId = "123456789012345678901234";
    const pipeline = buildVectorSearchPipeline({
      ...defaultParams,
      campaignId: customCampaignId,
    });

    expect(pipeline[0].$vectorSearch.filter.campaignId).toEqual({
      $oid: customCampaignId,
    });
  });

  test("Unit -> buildVectorSearchPipeline handles different queryVector values", () => {
    const customVector = [0.5, 0.6, 0.7, 0.8];
    const pipeline = buildVectorSearchPipeline({
      ...defaultParams,
      queryVector: customVector,
    });

    expect(pipeline[0].$vectorSearch.queryVector).toEqual(customVector);
  });

  test("Unit -> buildVectorSearchPipeline includes all required projection fields", () => {
    const pipeline = buildVectorSearchPipeline(defaultParams);
    const projection = pipeline[4].$project;

    const requiredFields = [
      "_id",
      "campaignId",
      "name",
      "recordType",
      "gmSummary",
      "gmNotes",
      "playerSummary",
      "playerNotes",
      "createdAt",
      "updatedAt",
      "locationData",
      "plotData",
      "npcData",
      "sessionEventLink",
      "score",
    ];

    requiredFields.forEach((field) => {
      expect(projection).toHaveProperty(field, 1);
    });
  });

  test.each<RecordType>(["NPC", "Location", "Plot"])(
    "Unit -> buildVectorSearchPipeline handles %s recordType",
    (recordType) => {
      const pipeline = buildVectorSearchPipeline({
        ...defaultParams,
        recordType,
      });

      expect(pipeline[3].$match.recordType).toBe(recordType);
    }
  );
});
