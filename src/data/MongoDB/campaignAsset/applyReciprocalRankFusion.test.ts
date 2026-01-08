import { describe, expect, test } from "bun:test";
import {
  applyReciprocalRankFusion,
  normalizeRRFScores,
  type RRFResult,
} from "./applyReciprocalRankFusion";
import type { AssetSearchResult } from "./assetSearch";

// Helper to create mock search results
function createMockResult(
  id: string,
  name: string,
  score: number
): AssetSearchResult {
  return {
    id,
    campaignId: "campaign-1",
    name,
    recordType: "NPC",
    gmSummary: `Summary for ${name}`,
    gmNotes: null,
    playerSummary: null,
    playerNotes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    sessionEventLink: [],
    score,
    locationData: null,
    npcData: null,
    plotData: null,
  };
}

describe("applyReciprocalRankFusion", () => {
  const k = 60; // Standard RRF constant

  test("Unit -> applyReciprocalRankFusion combines results from both lists", () => {
    const vectorResults = [
      createMockResult("1", "Asset A", 0.95),
      createMockResult("2", "Asset B", 0.85),
    ];
    const textResults = [
      createMockResult("2", "Asset B", 0.9),
      createMockResult("3", "Asset C", 0.8),
    ];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    // Should have all 3 unique assets
    expect(results.length).toBe(3);
    expect(results.map((r) => r.id)).toContain("1");
    expect(results.map((r) => r.id)).toContain("2");
    expect(results.map((r) => r.id)).toContain("3");
  });

  test("Unit -> applyReciprocalRankFusion ranks item in both lists highest", () => {
    const vectorResults = [
      createMockResult("1", "Asset A", 0.95),
      createMockResult("2", "Asset B", 0.85),
    ];
    const textResults = [
      createMockResult("2", "Asset B", 0.9),
      createMockResult("1", "Asset A", 0.8),
    ];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    // Asset A: rank 1 in vector, rank 2 in text = 1/61 + 1/62
    // Asset B: rank 2 in vector, rank 1 in text = 1/62 + 1/61
    // Both should have the same RRF score
    expect(results[0].rrfScore).toBeCloseTo(results[1].rrfScore, 10);
  });

  test("Unit -> applyReciprocalRankFusion calculates correct RRF scores", () => {
    const vectorResults = [createMockResult("1", "Asset A", 0.95)];
    const textResults = [createMockResult("1", "Asset A", 0.9)];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    // Rank 1 in both lists: 1/(60+1) + 1/(60+1) = 2/61
    const expectedScore = 2 / 61;
    expect(results[0].rrfScore).toBeCloseTo(expectedScore, 10);
  });

  test("Unit -> applyReciprocalRankFusion handles item in only one list", () => {
    const vectorResults = [
      createMockResult("1", "Asset A", 0.95),
      createMockResult("2", "Asset B", 0.85),
    ];
    const textResults = [createMockResult("3", "Asset C", 0.9)];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    // Asset 1: rank 1 in vector, defaultRank (3) in text = 1/61 + 1/63
    // Asset 2: rank 2 in vector, defaultRank (3) in text = 1/62 + 1/63
    // Asset 3: defaultRank (3) in vector, rank 1 in text = 1/63 + 1/61

    const asset1 = results.find((r) => r.id === "1")!;
    const asset3 = results.find((r) => r.id === "3")!;

    // Asset 1 and 3 should have same RRF score (symmetric)
    expect(asset1.rrfScore).toBeCloseTo(asset3.rrfScore, 10);
  });

  test("Unit -> applyReciprocalRankFusion returns results sorted by RRF score", () => {
    const vectorResults = [
      createMockResult("1", "Asset A", 0.95),
      createMockResult("2", "Asset B", 0.85),
      createMockResult("3", "Asset C", 0.75),
    ];
    const textResults = [
      createMockResult("3", "Asset C", 0.95),
      createMockResult("2", "Asset B", 0.85),
      createMockResult("1", "Asset A", 0.75),
    ];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    // Results should be sorted by rrfScore descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].rrfScore).toBeGreaterThanOrEqual(
        results[i].rrfScore
      );
    }
  });

  test("Unit -> applyReciprocalRankFusion handles empty vector results", () => {
    const vectorResults: AssetSearchResult[] = [];
    const textResults = [
      createMockResult("1", "Asset A", 0.9),
      createMockResult("2", "Asset B", 0.8),
    ];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    expect(results.length).toBe(2);
    // All items get default rank (1) for vector, actual ranks for text
    // Asset 1: 1/(60+1) + 1/(60+1) for vector default=1
    // Actually, defaultRank = max(0, 2, 1) + 1 = 3
  });

  test("Unit -> applyReciprocalRankFusion handles empty text results", () => {
    const vectorResults = [
      createMockResult("1", "Asset A", 0.95),
      createMockResult("2", "Asset B", 0.85),
    ];
    const textResults: AssetSearchResult[] = [];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    expect(results.length).toBe(2);
  });

  test("Unit -> applyReciprocalRankFusion handles both empty lists", () => {
    const results = applyReciprocalRankFusion([], [], k);
    expect(results.length).toBe(0);
  });

  test("Unit -> applyReciprocalRankFusion preserves original result data", () => {
    const vectorResults = [createMockResult("1", "Asset A", 0.95)];
    const textResults: AssetSearchResult[] = [];

    const results = applyReciprocalRankFusion(vectorResults, textResults, k);

    expect(results[0].id).toBe("1");
    expect(results[0].name).toBe("Asset A");
    expect(results[0].recordType).toBe("NPC");
    expect(results[0].campaignId).toBe("campaign-1");
  });

  test("Unit -> applyReciprocalRankFusion respects custom k value", () => {
    const vectorResults = [createMockResult("1", "Asset A", 0.95)];
    const textResults = [createMockResult("1", "Asset A", 0.9)];

    const resultsK60 = applyReciprocalRankFusion(
      vectorResults,
      textResults,
      60
    );
    const resultsK30 = applyReciprocalRankFusion(
      vectorResults,
      textResults,
      30
    );

    // Lower k = higher RRF scores
    expect(resultsK30[0].rrfScore).toBeGreaterThan(resultsK60[0].rrfScore);
  });
});

describe("normalizeRRFScores", () => {
  function createRRFResult(id: string, rrfScore: number): RRFResult {
    return {
      ...createMockResult(id, `Asset ${id}`, 0),
      rrfScore,
    };
  }

  test("Unit -> normalizeRRFScores normalizes to 0-1 range", () => {
    const results: RRFResult[] = [
      createRRFResult("1", 0.033),
      createRRFResult("2", 0.02),
      createRRFResult("3", 0.01),
    ];

    const normalized = normalizeRRFScores(results);

    // Highest score should be 1.0
    expect(normalized[0].score).toBeCloseTo(1.0, 5);
    // Lowest score should be 0.0
    expect(normalized[2].score).toBeCloseTo(0.0, 5);
    // Middle score should be between 0 and 1
    expect(normalized[1].score).toBeGreaterThan(0);
    expect(normalized[1].score).toBeLessThan(1);
  });

  test("Unit -> normalizeRRFScores handles single result", () => {
    const results: RRFResult[] = [createRRFResult("1", 0.033)];

    const normalized = normalizeRRFScores(results);

    expect(normalized.length).toBe(1);
    expect(normalized[0].score).toBe(1.0);
  });

  test("Unit -> normalizeRRFScores handles empty results", () => {
    const normalized = normalizeRRFScores([]);
    expect(normalized.length).toBe(0);
  });

  test("Unit -> normalizeRRFScores handles equal scores", () => {
    const results: RRFResult[] = [
      createRRFResult("1", 0.033),
      createRRFResult("2", 0.033),
      createRRFResult("3", 0.033),
    ];

    const normalized = normalizeRRFScores(results);

    // All equal scores should become 1.0
    for (const result of normalized) {
      expect(result.score).toBe(1.0);
    }
  });

  test("Unit -> normalizeRRFScores calculates correct middle scores", () => {
    const results: RRFResult[] = [
      createRRFResult("1", 0.04),
      createRRFResult("2", 0.03),
      createRRFResult("3", 0.02),
    ];

    const normalized = normalizeRRFScores(results);

    // Middle score: (0.03 - 0.02) / (0.04 - 0.02) = 0.01 / 0.02 = 0.5
    expect(normalized[1].score).toBeCloseTo(0.5, 5);
  });

  test("Unit -> normalizeRRFScores preserves result order", () => {
    const results: RRFResult[] = [
      createRRFResult("1", 0.033),
      createRRFResult("2", 0.025),
      createRRFResult("3", 0.015),
    ];

    const normalized = normalizeRRFScores(results);

    expect(normalized[0].id).toBe("1");
    expect(normalized[1].id).toBe("2");
    expect(normalized[2].id).toBe("3");
  });

  test("Unit -> normalizeRRFScores preserves original data except score", () => {
    const results: RRFResult[] = [createRRFResult("1", 0.033)];
    results[0].name = "Test Asset";
    results[0].recordType = "Location";

    const normalized = normalizeRRFScores(results);

    expect(normalized[0].name).toBe("Test Asset");
    expect(normalized[0].recordType).toBe("Location");
  });
});
