import type { AssetSearchResult } from "./assetSearch";

/**
 * Result with RRF score attached.
 * The original score is preserved, and rrfScore contains the combined ranking score.
 */
export interface RRFResult extends AssetSearchResult {
  rrfScore: number;
}

/**
 * Applies Reciprocal Rank Fusion (RRF) to combine results from vector and text searches.
 *
 * RRF Formula: score = sum(1 / (k + rank)) for each ranking list
 * - k is a constant (default 60) that prevents high-ranked items from dominating
 * - Higher k = more weight to items ranked consistently across both lists
 * - Lower k = more weight to top-ranked items in either list
 *
 * @param vectorResults - Results from vector search, sorted by score descending
 * @param textResults - Results from text search, sorted by score descending
 * @param k - RRF constant (default 60, matches MongoDB's default)
 * @returns Combined results sorted by RRF score descending
 */
export function applyReciprocalRankFusion(
  vectorResults: AssetSearchResult[],
  textResults: AssetSearchResult[],
  k: number = 60
): RRFResult[] {
  // Build rank maps (1-indexed ranks based on position in sorted results)
  const vectorRanks = new Map<string, number>();
  vectorResults.forEach((result, index) => {
    vectorRanks.set(result.id, index + 1);
  });

  const textRanks = new Map<string, number>();
  textResults.forEach((result, index) => {
    textRanks.set(result.id, index + 1);
  });

  // Collect all unique asset IDs
  const allIds = new Set<string>([...vectorRanks.keys(), ...textRanks.keys()]);

  // Default rank for items not found in a list
  // Using max list length + 1 means missing items get a poor but not infinite rank
  const defaultRank = Math.max(vectorResults.length, textResults.length, 1) + 1;

  // Build result map for quick lookup
  const resultMap = new Map<string, AssetSearchResult>();
  for (const result of vectorResults) {
    resultMap.set(result.id, result);
  }
  for (const result of textResults) {
    // Text results may have different scores, but we keep the first occurrence
    if (!resultMap.has(result.id)) {
      resultMap.set(result.id, result);
    }
  }

  // Calculate RRF scores
  const rrfResults: RRFResult[] = [];
  for (const id of allIds) {
    const vectorRank = vectorRanks.get(id) ?? defaultRank;
    const textRank = textRanks.get(id) ?? defaultRank;

    // RRF formula: sum of reciprocal ranks
    const rrfScore = 1 / (k + vectorRank) + 1 / (k + textRank);

    const baseResult = resultMap.get(id)!;
    rrfResults.push({
      ...baseResult,
      rrfScore,
    });
  }

  // Sort by RRF score descending
  return rrfResults.sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Normalizes RRF scores to a 0-1 range for consistency with vector/text search scores.
 *
 * RRF raw scores are typically small (0.009 - 0.033 for k=60):
 * - Max possible: 2 * (1 / (k + 1)) = 2/61 ≈ 0.0328 (rank 1 in both lists)
 * - Min practical: 2 * (1 / (k + defaultRank)) varies by list sizes
 *
 * Uses min-max normalization based on actual scores in the result set.
 *
 * @param results - RRF results with raw rrfScore values
 * @returns Results with normalized scores (0-1 range)
 */
export function normalizeRRFScores(results: RRFResult[]): AssetSearchResult[] {
  if (results.length === 0) {
    return [];
  }

  if (results.length === 1) {
    // Single result gets score of 1.0
    return [{ ...results[0], score: 1.0 }];
  }

  // Find min and max RRF scores
  const scores = results.map((r) => r.rrfScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  // Avoid division by zero if all scores are equal
  const range = maxScore - minScore;
  if (range === 0) {
    // All items have equal RRF score, give them all 1.0
    return results.map((r) => ({ ...r, score: 1.0 }));
  }

  // Min-max normalization to 0-1 range
  return results.map((r) => ({
    ...r,
    score: (r.rrfScore - minScore) / range,
  }));
}
