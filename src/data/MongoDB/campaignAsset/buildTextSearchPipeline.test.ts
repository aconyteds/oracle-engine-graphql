import { describe, expect, test } from "bun:test";
import type { RecordType } from "@prisma/client";
import type { Document } from "mongodb";
import type { TextSearchPipelineParams } from "./buildTextSearchPipeline";
import { buildTextSearchPipeline } from "./buildTextSearchPipeline";

describe("buildTextSearchPipeline", () => {
  // Default test parameters - reusable across tests
  const defaultParams: TextSearchPipelineParams = {
    keywords: "dragon",
    campaignId: "507f1f77bcf86cd799439011",
    limit: 10,
    minScore: 0.5,
  };

  test("Unit -> buildTextSearchPipeline builds basic pipeline without recordType", () => {
    const pipeline = buildTextSearchPipeline(defaultParams);

    expect(Array.isArray(pipeline)).toBe(true);
    expect(pipeline.length).toBe(7); // Without recordType filter

    // Verify $search stage structure
    const searchStage = pipeline[0] as Document;
    expect(searchStage.$search).toBeDefined();
    expect(searchStage.$search.index).toBe("gm_asset_search");
    expect(searchStage.$search.compound.should).toHaveLength(3);
    expect(searchStage.$search.compound.minimumShouldMatch).toBe(1);

    // Verify field boosting
    expect(searchStage.$search.compound.should[0].text.path).toBe("name");
    expect(searchStage.$search.compound.should[0].text.score.boost.value).toBe(
      5
    );
    expect(searchStage.$search.compound.should[1].text.path).toBe("gmSummary");
    expect(searchStage.$search.compound.should[1].text.score.boost.value).toBe(
      2
    );
    expect(searchStage.$search.compound.should[2].text.path).toBe("gmNotes");
    expect(searchStage.$search.compound.should[2].text.score).toBeUndefined();

    // Verify campaignId filter
    expect(searchStage.$search.compound.filter[0].equals.path).toBe(
      "campaignId"
    );
    expect(searchStage.$search.compound.filter[0].equals.value.$oid).toBe(
      defaultParams.campaignId
    );
  });

  test("Unit -> buildTextSearchPipeline includes recordType filter when provided", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      recordType: "NPC" as RecordType,
    };

    const pipeline = buildTextSearchPipeline(params);

    expect(pipeline.length).toBe(8); // With recordType filter

    // Find the recordType $match stage (should be after normalization filter)
    const recordTypeMatch = pipeline.find(
      (stage) => stage.$match && stage.$match.recordType
    ) as Document;
    expect(recordTypeMatch).toBeDefined();
    expect(recordTypeMatch.$match.recordType).toBe("NPC");
  });

  test("Unit -> buildTextSearchPipeline adds textScore field", () => {
    const pipeline = buildTextSearchPipeline(defaultParams);

    const addFieldsStage = pipeline[1] as Document;
    expect(addFieldsStage.$addFields).toBeDefined();
    expect(addFieldsStage.$addFields.textScore).toEqual({
      $meta: "searchScore",
    });
  });

  test("Unit -> buildTextSearchPipeline applies limit before normalization", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      limit: 20,
    };

    const pipeline = buildTextSearchPipeline(params);

    const limitStage = pipeline[2] as Document;
    expect(limitStage.$limit).toBe(40); // limit * 2
  });

  test("Unit -> buildTextSearchPipeline normalizes score with asymptotic formula", () => {
    const pipeline = buildTextSearchPipeline(defaultParams);

    const normalizeStage = pipeline[3] as Document;
    expect(normalizeStage.$addFields).toBeDefined();
    expect(normalizeStage.$addFields.normalizedScore).toEqual({
      $divide: ["$textScore", { $add: ["$textScore", 1] }],
    });
  });

  test("Unit -> buildTextSearchPipeline filters by minimum score", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      minScore: 0.75,
    };

    const pipeline = buildTextSearchPipeline(params);

    const scoreMatchStage = pipeline[4] as Document;
    expect(scoreMatchStage.$match).toBeDefined();
    expect(scoreMatchStage.$match.normalizedScore).toEqual({ $gte: 0.75 });
  });

  test("Unit -> buildTextSearchPipeline applies final limit", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      limit: 15,
    };

    const pipeline = buildTextSearchPipeline(params);

    // Second to last stage should be final limit
    const finalLimitStage = pipeline[pipeline.length - 2] as Document;
    expect(finalLimitStage.$limit).toBe(15);
  });

  test("Unit -> buildTextSearchPipeline projects correct fields with score mapping", () => {
    const pipeline = buildTextSearchPipeline(defaultParams);

    const projectStage = pipeline[pipeline.length - 1] as Document;
    expect(projectStage.$project).toBeDefined();

    const expectedFields = [
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
    ];

    expectedFields.forEach((field) => {
      expect(projectStage.$project[field]).toBe(1);
    });

    expect(projectStage.$project.score).toBe("$normalizedScore");
  });

  test("Unit -> buildTextSearchPipeline handles different keywords", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      keywords: "ancient temple ruins",
    };

    const pipeline = buildTextSearchPipeline(params);

    const searchStage = pipeline[0] as Document;
    expect(searchStage.$search.compound.should[0].text.query).toBe(
      "ancient temple ruins"
    );
    expect(searchStage.$search.compound.should[1].text.query).toBe(
      "ancient temple ruins"
    );
    expect(searchStage.$search.compound.should[2].text.query).toBe(
      "ancient temple ruins"
    );
  });

  test("Unit -> buildTextSearchPipeline handles different campaignIds", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      campaignId: "123456789abcdef012345678",
    };

    const pipeline = buildTextSearchPipeline(params);

    const searchStage = pipeline[0] as Document;
    expect(searchStage.$search.compound.filter[0].equals.value.$oid).toBe(
      "123456789abcdef012345678"
    );
  });

  test("Unit -> buildTextSearchPipeline handles zero minScore", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      minScore: 0,
    };

    const pipeline = buildTextSearchPipeline(params);

    const scoreMatchStage = pipeline[4] as Document;
    expect(scoreMatchStage.$match.normalizedScore).toEqual({ $gte: 0 });
  });

  test("Unit -> buildTextSearchPipeline handles maximum minScore", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      minScore: 1,
    };

    const pipeline = buildTextSearchPipeline(params);

    const scoreMatchStage = pipeline[4] as Document;
    expect(scoreMatchStage.$match.normalizedScore).toEqual({ $gte: 1 });
  });

  test("Unit -> buildTextSearchPipeline maintains correct stage order without recordType", () => {
    const pipeline = buildTextSearchPipeline(defaultParams);

    expect(pipeline[0].$search).toBeDefined();
    expect(pipeline[1].$addFields?.textScore).toBeDefined();
    expect(pipeline[2].$limit).toBeDefined();
    expect(pipeline[3].$addFields?.normalizedScore).toBeDefined();
    expect(pipeline[4].$match?.normalizedScore).toBeDefined();
    expect(pipeline[5].$limit).toBeDefined();
    expect(pipeline[6].$project).toBeDefined();
  });

  test("Unit -> buildTextSearchPipeline maintains correct stage order with recordType", () => {
    const params: TextSearchPipelineParams = {
      ...defaultParams,
      recordType: "LOCATION" as RecordType,
    };

    const pipeline = buildTextSearchPipeline(params);

    expect(pipeline[0].$search).toBeDefined();
    expect(pipeline[1].$addFields?.textScore).toBeDefined();
    expect(pipeline[2].$limit).toBeDefined();
    expect(pipeline[3].$addFields?.normalizedScore).toBeDefined();
    expect(pipeline[4].$match?.normalizedScore).toBeDefined();
    expect(pipeline[5].$match?.recordType).toBeDefined();
    expect(pipeline[6].$limit).toBeDefined();
    expect(pipeline[7].$project).toBeDefined();
  });
});
