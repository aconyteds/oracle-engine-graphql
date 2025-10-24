/**
 * Context for sharing data between nodes in a workflow.
 * This allows nodes to pass data to subsequent nodes.
 */
export class WorkflowContext {
  private data: Map<string, unknown> = new Map();

  /**
   * Store a value in the context
   */
  set<T>(key: string, value: T): void {
    this.data.set(key, value);
  }

  /**
   * Retrieve a value from the context (returns undefined if not found)
   */
  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  /**
   * Retrieve a required value from the context (throws if not found)
   */
  require<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(
        `Required context value missing: ${key}. Available keys: ${Array.from(this.data.keys()).join(", ")}`
      );
    }
    return value;
  }

  /**
   * Check if a key exists in the context
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Remove a value from the context
   */
  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /**
   * Clear all values from the context
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get all keys in the context
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get a snapshot of all data in the context
   */
  toObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.data.entries()) {
      obj[key] = value;
    }
    return obj;
  }
}
