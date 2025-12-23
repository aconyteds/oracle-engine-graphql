import * as Sentry from "@sentry/bun";
import { DBClient } from "./client";

/**
 * Timing information for different phases of search execution
 */
export interface SearchTimings {
  total: number;
  embedding: number;
  vectorSearch: number;
  conversion: number;
}

export type SaveSearchMetricsParams = {
  searchType: string;
  query?: string;
  campaignId: string;
  limit: number;
  minScore: number;
  resultScores: number[];
  expandedResultScores: number[] | null;
  timings: SearchTimings;
  totalItemCount: number | null;
};

/**
 * Saves search metrics to MongoDB for historical analysis.
 * Metrics are captured asynchronously and should not affect search performance.
 *
 * Basic metrics are saved for every search request:
 * - Hit/no-hit status
 * - Result counts
 * - Execution timings
 * - Query length
 *
 * Sampled metrics are saved based on SEARCH_METRICS_SAMPLE_RATE:
 * - Full query text
 * - Precision and recall at k and 200
 * - Score distributions
 * - Coverage ratios
 *
 * @param input - Search parameters and results to save metrics for
 */
export async function saveSearchMetrics(
  input: SaveSearchMetricsParams
): Promise<void> {
  const {
    searchType,
    query,
    campaignId,
    limit,
    minScore,
    resultScores,
    expandedResultScores,
    timings,
    totalItemCount,
  } = input;
  try {
    const sampled = !!expandedResultScores;

    let sampledMetrics: SampledMetrics | undefined;
    if (sampled) {
      sampledMetrics = collectSampledMetrics(
        resultScores,
        limit,
        expandedResultScores!,
        totalItemCount!
      );
    }

    // 1) Overall search latency
    Sentry.metrics.distribution(
      `${searchType}.execution_time_ms`,
      timings.total
    );

    // 2) Result count
    Sentry.metrics.distribution(
      `${searchType}.result_count`,
      resultScores.length
    );

    // 3) Quality proxy (sampled only)
    if (sampledMetrics) {
      Sentry.metrics.distribution(
        `${searchType}.precision_at_k`,
        sampledMetrics.precisionAtK
      );
    }

    // Save metrics to database
    await DBClient.searchMetric.create({
      data: {
        searchType,
        campaignId,
        hasResults: resultScores.length > 0,
        resultCount: resultScores.length,
        requestedLimit: limit,
        minScore,
        executionTimeMs: timings.total,
        embeddingTimeMs: timings.embedding,
        vectorTimeMs: timings.vectorSearch,
        conversionTimeMs: timings.conversion,
        queryLength: query?.length ?? 0,

        // Query text - only store when sampled for privacy/storage
        query: sampled ? (query ?? "") : "",

        // Sampling flag
        sampled,

        // Sampled metrics - null when not sampled
        precisionAtK: sampledMetrics?.precisionAtK ?? null,
        recallAtK: sampledMetrics?.recallAtK ?? null,
        f1AtK: sampledMetrics?.f1ScoreAtK ?? null,
        precisionAt200: sampledMetrics?.precisionAt200 ?? null,
        recallAt200: sampledMetrics?.recallAt200 ?? null,
        f1At200: sampledMetrics?.f1ScoreAt200 ?? null,
        coverageRatio: sampledMetrics?.coverageRatio ?? null,
        scoreMean: sampledMetrics?.scoreStats.mean ?? null,
        scoreMedian: sampledMetrics?.scoreStats.median ?? null,
        scoreMin: sampledMetrics?.scoreStats.min ?? null,
        scoreMax: sampledMetrics?.scoreStats.max ?? null,
        scoreStdDev: sampledMetrics?.scoreStats.stdDev ?? null,
        totalAssets: sampledMetrics?.totalItems ?? null,
      },
    });
  } catch (error) {
    // Metrics capture should never throw or affect search functionality
    console.error("Search metrics save failed:", error);
  }
}

/**
 * Score statistics calculated from search results
 */
interface ScoreStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

/**
 * Calculates statistical measures for score distribution.
 *
 * @param scores - Array of vector similarity scores
 * @returns Score statistics (mean, median, min, max, standard deviation)
 */
function calculateScoreStats(scores: number[]): ScoreStats {
  if (scores.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const sum = scores.reduce((acc, score) => acc + score, 0);
  const mean = sum / scores.length;

  const median =
    scores.length % 2 === 0
      ? (sorted[scores.length / 2 - 1] + sorted[scores.length / 2]) / 2
      : sorted[Math.floor(scores.length / 2)];

  const variance =
    scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) /
    scores.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    min,
    max,
    stdDev,
  };
}

type PrecisionRecallMetrics = {
  precisionAtK: number;
  recallAtK: number;
  precisionAt200: number;
  recallAt200: number;
  f1ScoreAtK: number;
  f1ScoreAt200: number;
  coverageRatio: number;
};

/**
 * Calculates precision and recall metrics at k and at 200.
 *
 * Without a golden dataset, we use the expanded search results as a proxy for relevance:
 * - "Relevant" = results that meet the minScore threshold
 * - Precision at k = results at k / k
 * - Recall at k = results at k / results at 200
 * - F1 Score = 2 * (precision * recall) / (precision + recall)
 * - Coverage = results / total assets in campaign
 *
 * @param resultsAtK - Number of results returned at requested limit k
 * @param resultsAt200 - Number of results returned at limit 200
 * @param totalAssets - Total number of assets in the campaign
 * @param k - Requested limit from original search
 * @returns Precision, recall, F1 score, and coverage metrics
 */
function calculatePrecisionRecall(
  resultsAtK: number,
  resultsAt200: number,
  totalAssets: number,
  k: number
): PrecisionRecallMetrics {
  // Precision at k = actual results / requested results
  const precisionAtK = k > 0 ? resultsAtK / k : 0;

  // Recall at k = results at k / total relevant (proxy: results at 200)
  const recallAtK = resultsAt200 > 0 ? resultsAtK / resultsAt200 : 0;

  // F1 Score at k = harmonic mean of precision and recall
  const f1ScoreAtK =
    precisionAtK + recallAtK > 0
      ? (2 * precisionAtK * recallAtK) / (precisionAtK + recallAtK)
      : 0;

  // Precision at 200 = actual results / 200
  const precisionAt200 = resultsAt200 / 200;

  // Recall at 200 = results at 200 / total assets (proxy for all possible results)
  const recallAt200 = totalAssets > 0 ? resultsAt200 / totalAssets : 0;

  // F1 Score at 200 = harmonic mean of precision and recall at 200
  const f1ScoreAt200 =
    precisionAt200 + recallAt200 > 0
      ? (2 * precisionAt200 * recallAt200) / (precisionAt200 + recallAt200)
      : 0;

  // Coverage = how much of the dataset was searched
  const coverageRatio = totalAssets > 0 ? resultsAtK / totalAssets : 0;

  return {
    precisionAtK,
    recallAtK,
    precisionAt200,
    recallAt200,
    f1ScoreAtK,
    f1ScoreAt200,
    coverageRatio,
  };
}

/**
 * Advanced metrics captured for sampled search requests
 */
interface SampledMetrics {
  totalItems: number;
  topKScores: number[];
  expandedScores: number[];
  precisionAtK: number;
  recallAtK: number;
  precisionAt200: number;
  recallAt200: number;
  f1ScoreAtK: number;
  f1ScoreAt200: number;
  coverageRatio: number;
  scoreStats: ScoreStats;
}

/**
 * Collects advanced metrics for sampled search requests.
 * Executes an expanded search with k=200 to calculate precision/recall metrics.
 *
 * @param input - Original search input and results
 * @returns Sampled metrics including precision, recall, and score statistics
 */
function collectSampledMetrics(
  results: number[],
  k: number,
  expandedResults: number[],
  totalCount: number
): SampledMetrics {
  // Calculate precision and recall
  const metrics = calculatePrecisionRecall(
    results.length,
    expandedResults.length,
    totalCount,
    k
  );

  // Calculate score statistics from original results
  const scoreStats = calculateScoreStats(results);
  return {
    totalItems: totalCount,
    topKScores: results,
    expandedScores: expandedResults,
    ...metrics,
    scoreStats,
  };
}
