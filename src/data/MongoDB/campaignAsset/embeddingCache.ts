/**
 * LRU (Least Recently Used) cache for embedding vectors
 * Caches search query embeddings to reduce OpenAI API calls
 */

interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number; // Date.now() when generated
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * LRU Cache for storing embedding vectors with automatic eviction
 * Uses Map for O(1) lookups and maintains access order for LRU eviction
 */
class EmbeddingCache {
  private cache: Map<string, EmbeddingCacheEntry>;
  private maxSize: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Normalizes query string for consistent cache keys
   * - Trims whitespace
   * - Converts to lowercase
   */
  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase();
  }

  /**
   * Retrieves cached embedding for a query
   * Returns undefined if not found
   * Updates access order (moves to end) on hit
   */
  get(query: string): number[] | undefined {
    const normalizedQuery = this.normalizeQuery(query);
    const entry = this.cache.get(normalizedQuery);

    if (entry) {
      this.hits++;
      // Update access order by deleting and re-adding
      this.cache.delete(normalizedQuery);
      this.cache.set(normalizedQuery, entry);
      return entry.embedding;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Stores embedding in cache with timestamp
   * Evicts least recently used entry if cache is full
   */
  set(query: string, embedding: number[]): void {
    const normalizedQuery = this.normalizeQuery(query);

    // If cache is full and key doesn't exist, evict oldest entry
    if (this.cache.size >= this.maxSize && !this.cache.has(normalizedQuery)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }

    // Store entry with current timestamp
    this.cache.set(normalizedQuery, {
      embedding,
      timestamp: Date.now(),
    });
  }

  /**
   * Returns current cache metrics including hit rate
   */
  getMetrics(): CacheMetrics {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
    };
  }

  /**
   * Clears all cache entries and resets metrics
   * Useful for testing
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Returns current cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// Get max size from environment or use default
const maxSize = Bun.env.EMBEDDING_CACHE_MAX_SIZE
  ? parseInt(Bun.env.EMBEDDING_CACHE_MAX_SIZE, 10)
  : 1000;

// Export singleton instance
export const embeddingCache = new EmbeddingCache(maxSize);

// Export metrics getter
export const getCacheMetrics = (): CacheMetrics => embeddingCache.getMetrics();
