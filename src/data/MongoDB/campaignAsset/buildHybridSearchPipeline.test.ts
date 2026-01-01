import { describe, expect, test } from "bun:test";
import type { RecordType } from "@prisma/client";
import type { HybridSearchPipelineParams } from "./buildHybridSearchPipeline";
import { buildHybridSearchPipeline } from "./buildHybridSearchPipeline";

describe("buildHybridSearchPipeline", () => {
  // Default mock data - reusable across tests
  const defaultParams: HybridSearchPipelineParams = {
    queryVector: [0.1, 0.2, 0.3],
    keywords: "test search",
    campaignId: "507f1f77bcf86cd799439011",
    limit: 10,
    minScore: 0.5,
  };

  test("Unit -> buildHybridSearchPipeline builds basic pipeline without recordType", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    expect(Array.isArray(pipeline)).toBe(true);
    expect(pipeline.length).toBeGreaterThan(0);

    // Verify $rankFusion stage
    const rankFusionStage = pipeline[0];
    expect(rankFusionStage.$rankFusion).toBeDefined();
    expect(
      rankFusionStage.$rankFusion.input.pipelines.vectorSearch
    ).toBeDefined();
    expect(
      rankFusionStage.$rankFusion.input.pipelines.textSearch
    ).toBeDefined();
    expect(rankFusionStage.$rankFusion.combination.weights.vectorSearch).toBe(
      0.5
    );
    expect(rankFusionStage.$rankFusion.combination.weights.textSearch).toBe(
      0.5
    );
    expect(rankFusionStage.$rankFusion.scoreDetails).toBe(true);
  });

  test("Unit -> buildHybridSearchPipeline configures vector search correctly", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    const vectorSearch =
      pipeline[0].$rankFusion.input.pipelines.vectorSearch[0].$vectorSearch;
    expect(vectorSearch.index).toBe("campaign_asset_vector_index");
    expect(vectorSearch.path).toBe("Embeddings");
    expect(vectorSearch.queryVector).toEqual(defaultParams.queryVector);
    expect(vectorSearch.numCandidates).toBe(defaultParams.limit * 10);
    expect(vectorSearch.limit).toBe(defaultParams.limit * 2);
    expect(vectorSearch.filter.campaignId.$oid).toBe(defaultParams.campaignId);
  });

  test("Unit -> buildHybridSearchPipeline configures text search with correct boosts", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    const textSearch =
      pipeline[0].$rankFusion.input.pipelines.textSearch[0].$search;
    expect(textSearch.index).toBe("gm_asset_search");
    expect(textSearch.compound.should).toHaveLength(3);

    // Name field with 5x boost
    expect(textSearch.compound.should[0].text.path).toBe("name");
    expect(textSearch.compound.should[0].text.query).toBe(
      defaultParams.keywords
    );
    expect(textSearch.compound.should[0].text.score.boost.value).toBe(5);

    // gmSummary field with 2x boost
    expect(textSearch.compound.should[1].text.path).toBe("gmSummary");
    expect(textSearch.compound.should[1].text.score.boost.value).toBe(2);

    // gmNotes field with no boost
    expect(textSearch.compound.should[2].text.path).toBe("gmNotes");
    expect(textSearch.compound.should[2].text.score).toBeUndefined();
  });

  test("Unit -> buildHybridSearchPipeline includes campaignId filter in text search", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    const textSearch =
      pipeline[0].$rankFusion.input.pipelines.textSearch[0].$search;
    expect(textSearch.compound.filter).toHaveLength(1);
    expect(textSearch.compound.filter[0].equals.path).toBe("campaignId");
    expect(textSearch.compound.filter[0].equals.value.$oid).toBe(
      defaultParams.campaignId
    );
  });

  test("Unit -> buildHybridSearchPipeline includes score normalization stages", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    // Find rawRRFScore stage
    const rawScoreStage = pipeline.find(
      (stage) => stage.$addFields?.rawRRFScore
    );
    expect(rawScoreStage).toBeDefined();
    expect(rawScoreStage?.$addFields.rawRRFScore.$meta).toBe("score");

    // Find normalizedScore stage
    const normalizedScoreStage = pipeline.find(
      (stage) => stage.$addFields?.normalizedScore?.$divide
    );
    expect(normalizedScoreStage).toBeDefined();

    // Find clamped score stage
    const clampedScoreStage = pipeline.find(
      (stage) => stage.$addFields?.score?.$max
    );
    expect(clampedScoreStage).toBeDefined();
  });

  test("Unit -> buildHybridSearchPipeline includes minScore filter", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    const scoreMatchStage = pipeline.find(
      (stage) => stage.$match?.score?.$gte !== undefined
    );
    expect(scoreMatchStage).toBeDefined();
    expect(scoreMatchStage?.$match.score.$gte).toBe(defaultParams.minScore);
  });

  test("Unit -> buildHybridSearchPipeline includes recordType filter when specified", () => {
    const paramsWithRecordType: HybridSearchPipelineParams = {
      ...defaultParams,
      recordType: "NPC" as RecordType,
    };

    const pipeline = buildHybridSearchPipeline(paramsWithRecordType);

    const recordTypeMatchStage = pipeline.find(
      (stage) => stage.$match?.recordType !== undefined
    );
    expect(recordTypeMatchStage).toBeDefined();
    expect(recordTypeMatchStage?.$match.recordType).toBe("NPC");
  });

  test("Unit -> buildHybridSearchPipeline excludes recordType filter when not specified", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    const recordTypeMatchStage = pipeline.find(
      (stage) => stage.$match?.recordType !== undefined
    );
    expect(recordTypeMatchStage).toBeUndefined();
  });

  test("Unit -> buildHybridSearchPipeline includes final limit stage", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    // Find all $limit stages
    const limitStages = pipeline.filter((stage) => stage.$limit !== undefined);

    // Last limit stage should match the requested limit
    const lastLimitStage = limitStages[limitStages.length - 1];
    expect(lastLimitStage.$limit).toBe(defaultParams.limit);
  });

  test("Unit -> buildHybridSearchPipeline includes projection stage with all required fields", () => {
    const pipeline = buildHybridSearchPipeline(defaultParams);

    const projectStage = pipeline.find((stage) => stage.$project !== undefined);
    expect(projectStage).toBeDefined();

    const projection = projectStage?.$project;
    expect(projection?._id).toBe(1);
    expect(projection?.campaignId).toBe(1);
    expect(projection?.name).toBe(1);
    expect(projection?.recordType).toBe(1);
    expect(projection?.gmSummary).toBe(1);
    expect(projection?.gmNotes).toBe(1);
    expect(projection?.playerSummary).toBe(1);
    expect(projection?.playerNotes).toBe(1);
    expect(projection?.createdAt).toBe(1);
    expect(projection?.updatedAt).toBe(1);
    expect(projection?.locationData).toBe(1);
    expect(projection?.plotData).toBe(1);
    expect(projection?.npcData).toBe(1);
    expect(projection?.sessionEventLink).toBe(1);
    expect(projection?.score).toBe(1);
  });

  test("Unit -> buildHybridSearchPipeline handles different limit values correctly", () => {
    const customParams: HybridSearchPipelineParams = {
      ...defaultParams,
      limit: 25,
    };

    const pipeline = buildHybridSearchPipeline(customParams);

    const vectorSearch =
      pipeline[0].$rankFusion.input.pipelines.vectorSearch[0].$vectorSearch;
    expect(vectorSearch.numCandidates).toBe(250); // limit * 10
    expect(vectorSearch.limit).toBe(50); // limit * 2

    const textSearchLimit =
      pipeline[0].$rankFusion.input.pipelines.textSearch[1].$limit;
    expect(textSearchLimit).toBe(50); // limit * 2
  });

  test("Unit -> buildHybridSearchPipeline handles empty keywords", () => {
    const paramsWithEmptyKeywords: HybridSearchPipelineParams = {
      ...defaultParams,
      keywords: "",
    };

    const pipeline = buildHybridSearchPipeline(paramsWithEmptyKeywords);

    const textSearch =
      pipeline[0].$rankFusion.input.pipelines.textSearch[0].$search;
    expect(textSearch.compound.should[0].text.query).toBe("");
  });

  test("Unit -> buildHybridSearchPipeline handles empty query vector", () => {
    const paramsWithEmptyVector: HybridSearchPipelineParams = {
      ...defaultParams,
      queryVector: [],
    };

    const pipeline = buildHybridSearchPipeline(paramsWithEmptyVector);

    const vectorSearch =
      pipeline[0].$rankFusion.input.pipelines.vectorSearch[0].$vectorSearch;
    expect(vectorSearch.queryVector).toEqual([]);
  });

  test("Unit -> buildHybridSearchPipeline handles minScore of 0", () => {
    const paramsWithZeroMinScore: HybridSearchPipelineParams = {
      ...defaultParams,
      minScore: 0,
    };

    const pipeline = buildHybridSearchPipeline(paramsWithZeroMinScore);

    const scoreMatchStage = pipeline.find(
      (stage) => stage.$match?.score?.$gte !== undefined
    );
    expect(scoreMatchStage?.$match.score.$gte).toBe(0);
  });

  test("Unit -> buildHybridSearchPipeline handles minScore of 1", () => {
    const paramsWithMaxMinScore: HybridSearchPipelineParams = {
      ...defaultParams,
      minScore: 1,
    };

    const pipeline = buildHybridSearchPipeline(paramsWithMaxMinScore);

    const scoreMatchStage = pipeline.find(
      (stage) => stage.$match?.score?.$gte !== undefined
    );
    expect(scoreMatchStage?.$match.score.$gte).toBe(1);
  });
});
