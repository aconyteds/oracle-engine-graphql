/**
 * Centralized environment configuration module.
 *
 * This module provides a single source of truth for all environment variables
 * used throughout the application. It includes type-safe exports, validation
 * for required variables, proper parsing, and sensible defaults.
 *
 * All application code should import from this module instead of accessing
 * process.env or Bun.env directly.
 */

/**
 * Helper to get environment variable value (Bun.env with process.env fallback)
 */
function getEnv(key: string): string | undefined {
  return Bun.env[key as keyof typeof Bun.env] || process.env[key];
}

/**
 * Helper to parse number environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper to clamp number to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate required environment variables based on NODE_ENV
 */
function validateEnvironment(nodeEnv: string): void {
  const required: Array<[string, string | undefined]> = [];

  // Always required
  required.push(
    ["DATABASE_URL", getEnv("DATABASE_URL")],
    ["OPENAI_API_KEY", getEnv("OPENAI_API_KEY")],
    ["FIREBASE_WEB_API_KEY", getEnv("FIREBASE_WEB_API_KEY")]
  );

  // Only validate in production
  if (nodeEnv === "production") {
    const missing = required.filter(([, value]) => !value).map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  } else {
    // In development/test, just warn about missing vars
    const missing = required.filter(([, value]) => !value).map(([key]) => key);

    if (missing.length > 0) {
      console.warn(
        `Warning: Missing environment variables: ${missing.join(", ")}`
      );
    }
  }
}

// Parse NODE_ENV first (needed for validation)
const nodeEnv = getEnv("NODE_ENV") || "development";

// Validate environment before exporting
validateEnvironment(nodeEnv);

/**
 * Centralized environment configuration object.
 * All environment variables should be accessed through this object.
 */
export const ENV = {
  /**
   * Server Configuration
   */

  /** The environment the app is running in: 'development' | 'production' | 'test' */
  NODE_ENV: nodeEnv as "development" | "production" | "test",

  /** The port the server listens on (default: 4000) */
  PORT: parseNumber(getEnv("PORT"), 4000),

  /**
   * OpenAI Configuration
   */

  /** OpenAI API key for model access (REQUIRED) */
  OPENAI_API_KEY: getEnv("OPENAI_API_KEY") || "",

  /**
   * Firebase Configuration
   */

  /** Firebase Admin SDK service account key as base64 encoded string (OPTIONAL) */
  FIREBASE_CONFIG_BASE64: getEnv("FIREBASE_CONFIG_BASE64"),

  /** Path to Google Application Credentials JSON file (OPTIONAL) */
  GOOGLE_APPLICATION_CREDENTIALS: getEnv("GOOGLE_APPLICATION_CREDENTIALS"),

  /** Firebase Web API key for client authentication (REQUIRED) */
  FIREBASE_WEB_API_KEY: getEnv("FIREBASE_WEB_API_KEY") || "",

  /**
   * LangSmith Configuration
   */

  /** LangSmith API key for trace authentication (OPTIONAL) */
  LANGSMITH_API_KEY: getEnv("LANGSMITH_API_KEY"),

  /** LangSmith API endpoint (OPTIONAL, defaults to https://api.smith.langchain.com) */
  LANGSMITH_ENDPOINT: getEnv("LANGSMITH_ENDPOINT"),

  /** LangSmith project name for organizing traces (OPTIONAL) */
  LANGSMITH_PROJECT: getEnv("LANGSMITH_PROJECT"),

  /**
   * Sentry Configuration
   */

  /** Sentry DSN for error tracking (OPTIONAL, only used in production) */
  SENTRY_DSN: getEnv("SENTRY_DSN"),

  /**
   * Database Configuration
   */

  /** MongoDB connection string (REQUIRED) */
  DATABASE_URL: getEnv("DATABASE_URL") || "",

  /**
   * Metrics Configuration
   */

  /**
   * Sample rate for detailed search metrics (0.0 to 1.0).
   * - 0.0 = no sampling (basic metrics only)
   * - 1.0 = 100% sampling (all searches get detailed metrics)
   * - Default: 0.05 (5% sampling)
   */
  SEARCH_METRICS_SAMPLE_RATE: clamp(
    parseNumber(getEnv("SEARCH_METRICS_SAMPLE_RATE"), 0.05),
    0.0,
    1.0
  ),

  /**
   * Cache Configuration
   */

  /** Maximum number of entries in the embedding cache (default: 1000) */
  EMBEDDING_CACHE_MAX_SIZE: parseNumber(
    getEnv("EMBEDDING_CACHE_MAX_SIZE"),
    1000
  ),

  /**
   * Hybrid search method: 'manual' (client-side RRF) or 'mongo' ($rankFusion)
   * Default: 'manual' (works on M0 tier)
   */
  HYBRID_SEARCH_METHOD: (getEnv("HYBRID_SEARCH_METHOD") || "manual") as
    | "manual"
    | "mongo",
} as const;
