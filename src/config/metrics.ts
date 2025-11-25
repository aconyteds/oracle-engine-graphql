/**
 * Centralized configuration for application metrics collection.
 *
 * This module provides configuration for metrics sampling rates and other
 * metrics-related settings. Configuration values are read from environment
 * variables with sensible defaults.
 */

/**
 * Search metrics configuration object.
 * Controls sampling behavior for detailed search metrics collection.
 */
export const SEARCH_METRICS_CONFIG = {
  /**
   * Sample rate for detailed search metrics (0.0 to 1.0).
   * - 0.0 = no sampling (only basic metrics)
   * - 1.0 = 100% sampling (all searches get detailed metrics)
   * - Default: 0.05 (5% sampling)
   *
   * Reads from SEARCH_METRICS_SAMPLE_RATE environment variable.
   * Falls back to 0.05 if not set or invalid.
   */
  sampleRate: parseFloat(
    Bun.env.SEARCH_METRICS_SAMPLE_RATE ||
      process.env.SEARCH_METRICS_SAMPLE_RATE ||
      "0.05"
  ),
};
