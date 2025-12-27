/**
 * MongoDB Standard Index Definitions
 *
 * This file contains definitions for standard MongoDB indexes (non-Atlas Search).
 * Indexes defined here are automatically created/updated by the setup-indexes.ts script.
 */

import type { CreateIndexesOptions, IndexSpecification } from "mongodb";

export interface StandardIndexDefinition {
  /**
   * The name of the index
   */
  name: string;

  /**
   * The collection this index applies to
   */
  collection: string;

  /**
   * The index specification (fields and direction)
   */
  indexSpec: IndexSpecification;

  /**
   * Options for the index (unique, sparse, expireAfterSeconds, etc.)
   */
  options?: CreateIndexesOptions;
}

export const standardIndexes: StandardIndexDefinition[] = [
  {
    name: "Checkpoint_createdAt_idx",
    collection: "Checkpoint",
    indexSpec: { createdAt: 1 },
    options: {
      expireAfterSeconds: 1_209_600, // 14 days
    },
  },
];
