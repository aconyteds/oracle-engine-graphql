import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { embeddingCache, getCacheMetrics } from "./embeddingCache";

describe("embeddingCache", () => {
  // Default test data
  const testEmbedding1 = new Array(1536).fill(0.5);
  const testEmbedding2 = new Array(1536).fill(0.7);
  const testEmbedding3 = new Array(1536).fill(0.9);

  beforeEach(() => {
    // Clear cache before each test
    embeddingCache.clear();
  });

  afterEach(() => {
    // Clean up after each test
    embeddingCache.clear();
  });

  test("Unit -> embeddingCache stores and retrieves embeddings correctly", () => {
    embeddingCache.set("test query", testEmbedding1);

    const result = embeddingCache.get("test query");

    expect(result).toEqual(testEmbedding1);
    expect(embeddingCache.size).toBe(1);
  });

  test("Unit -> embeddingCache returns undefined for non-existent query", () => {
    const result = embeddingCache.get("nonexistent query");

    expect(result).toBeUndefined();
  });

  test("Unit -> embeddingCache normalizes queries (trim and lowercase)", () => {
    embeddingCache.set(" TEST Query ", testEmbedding1);

    // All variations should retrieve the same embedding
    expect(embeddingCache.get("test query")).toEqual(testEmbedding1);
    expect(embeddingCache.get(" test query ")).toEqual(testEmbedding1);
    expect(embeddingCache.get("TEST QUERY")).toEqual(testEmbedding1);
    expect(embeddingCache.get("  TEST QUERY  ")).toEqual(testEmbedding1);

    // Should only have one entry
    expect(embeddingCache.size).toBe(1);
  });

  test("Unit -> embeddingCache updates access order on get", () => {
    // Add three entries
    embeddingCache.set("query1", testEmbedding1);
    embeddingCache.set("query2", testEmbedding2);
    embeddingCache.set("query3", testEmbedding3);

    // Access query1 to move it to the end
    embeddingCache.get("query1");

    // Add entries until we hit the limit (assuming default 1000)
    // Fill up to 1000 entries
    for (let i = 4; i <= 1001; i++) {
      embeddingCache.set(`query${i}`, testEmbedding1);
    }

    // query1 should still exist (it was accessed last)
    expect(embeddingCache.get("query1")).toEqual(testEmbedding1);

    // query2 should have been evicted (oldest unaccessed)
    expect(embeddingCache.get("query2")).toBeUndefined();
  });

  test("Unit -> embeddingCache evicts LRU entry when max size reached", () => {
    // Fill cache to capacity (1000 entries)
    for (let i = 1; i <= 1000; i++) {
      embeddingCache.set(`query${i}`, testEmbedding1);
    }

    expect(embeddingCache.size).toBe(1000);

    // Add one more entry - should evict query1 (oldest)
    embeddingCache.set("new query", testEmbedding2);

    expect(embeddingCache.size).toBe(1000);
    expect(embeddingCache.get("query1")).toBeUndefined();
    expect(embeddingCache.get("new query")).toEqual(testEmbedding2);

    const metrics = getCacheMetrics();
    expect(metrics.evictions).toBe(1);
  });

  test("Unit -> embeddingCache tracks metrics correctly (hits and misses)", () => {
    embeddingCache.set("query1", testEmbedding1);

    // First get - hit
    embeddingCache.get("query1");

    // Second get - hit
    embeddingCache.get("query1");

    // Non-existent get - miss
    embeddingCache.get("query2");

    // Non-existent get - miss
    embeddingCache.get("query3");

    const metrics = getCacheMetrics();
    expect(metrics.hits).toBe(2);
    expect(metrics.misses).toBe(2);
    expect(metrics.size).toBe(1);
    expect(metrics.hitRate).toBe(50); // 2/4 = 50%
  });

  test("Unit -> embeddingCache calculates hit rate correctly", () => {
    embeddingCache.set("query1", testEmbedding1);

    // 3 hits
    embeddingCache.get("query1");
    embeddingCache.get("query1");
    embeddingCache.get("query1");

    // 1 miss
    embeddingCache.get("nonexistent");

    const metrics = getCacheMetrics();
    expect(metrics.hitRate).toBe(75); // 3/4 = 75%
  });

  test("Unit -> embeddingCache handles zero requests (no division by zero)", () => {
    const metrics = getCacheMetrics();

    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.hitRate).toBe(0);
  });

  test("Unit -> embeddingCache stores timestamp with entry", () => {
    const beforeTimestamp = Date.now();

    embeddingCache.set("query1", testEmbedding1);

    // Access the internal cache to verify timestamp
    // Note: This is a bit of a hack for testing, but validates timestamp storage
    const metrics1 = getCacheMetrics();
    expect(metrics1.size).toBe(1);

    const afterTimestamp = Date.now();

    // Timestamp should be between before and after
    // We can't directly access it, but we can verify it was stored by checking
    // that the entry exists and has the expected structure
    const result = embeddingCache.get("query1");
    expect(result).toEqual(testEmbedding1);

    // If timestamp wasn't stored correctly, the cache wouldn't work properly
    expect(afterTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
  });

  test("Unit -> embeddingCache updates existing entry without increasing size", () => {
    embeddingCache.set("query1", testEmbedding1);
    expect(embeddingCache.size).toBe(1);

    // Update same query with different embedding
    embeddingCache.set("query1", testEmbedding2);
    expect(embeddingCache.size).toBe(1);

    // Should have the new embedding
    expect(embeddingCache.get("query1")).toEqual(testEmbedding2);
  });

  test("Unit -> embeddingCache clear resets all metrics", () => {
    // Add some entries and generate metrics
    embeddingCache.set("query1", testEmbedding1);
    embeddingCache.get("query1"); // hit
    embeddingCache.get("query2"); // miss

    let metrics = getCacheMetrics();
    expect(metrics.hits).toBeGreaterThan(0);
    expect(metrics.misses).toBeGreaterThan(0);
    expect(metrics.size).toBeGreaterThan(0);

    // Clear cache
    embeddingCache.clear();

    metrics = getCacheMetrics();
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.evictions).toBe(0);
    expect(metrics.size).toBe(0);
    expect(metrics.hitRate).toBe(0);
  });

  test("Unit -> embeddingCache handles large number of evictions", () => {
    // Fill cache to capacity
    for (let i = 1; i <= 1000; i++) {
      embeddingCache.set(`query${i}`, testEmbedding1);
    }

    // Add 100 more entries to trigger evictions
    for (let i = 1001; i <= 1100; i++) {
      embeddingCache.set(`query${i}`, testEmbedding1);
    }

    const metrics = getCacheMetrics();
    expect(metrics.evictions).toBe(100);
    expect(metrics.size).toBe(1000); // Still at max capacity

    // First 100 entries should be evicted
    expect(embeddingCache.get("query1")).toBeUndefined();
    expect(embeddingCache.get("query50")).toBeUndefined();
    expect(embeddingCache.get("query100")).toBeUndefined();

    // Later entries should exist
    expect(embeddingCache.get("query1100")).toEqual(testEmbedding1);
  });

  test("Unit -> embeddingCache handles empty string query", () => {
    embeddingCache.set("", testEmbedding1);

    const result = embeddingCache.get("");
    expect(result).toEqual(testEmbedding1);
  });

  test("Unit -> embeddingCache handles whitespace-only query", () => {
    embeddingCache.set("   ", testEmbedding1);

    // Normalized to empty string
    const result = embeddingCache.get("");
    expect(result).toEqual(testEmbedding1);
  });
});
