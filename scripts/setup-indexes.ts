#!/usr/bin/env bun

/**
 * MongoDB Atlas Vector Search Index Setup Script
 *
 * This script manages Atlas Search indexes defined in atlas-indexes/vectorIndexDefinitions.ts
 * It performs the following operations:
 * 1. Connects to MongoDB Atlas
 * 2. For each defined index:
 *    - Checks if the index exists
 *    - If it doesn't exist, creates it
 *    - If it exists, compares the definition with the desired state
 *    - If definitions differ, logs a warning (manual update required)
 *
 * Usage:
 *   bun run scripts/setup-vector-indexes.ts
 *   bun run vector-index:setup  (via package.json script)
 *
 * Environment Variables:
 *   DATABASE_URL - MongoDB Atlas connection string (required)
 */

import type { Collection } from "mongodb";
import { MongoClient } from "mongodb";
import {
  type AtlasSearchIndexDefinition,
  atlasSearchIndexes,
} from "./atlas-indexes/searchIndexDefinitions";
import {
  type StandardIndexDefinition,
  standardIndexes,
} from "./atlas-indexes/standardIndexDefinitions";
import {
  type AtlasVectorIndexDefinition,
  atlasIndexes,
} from "./atlas-indexes/vectorIndexDefinitions";

type ExistingIndexDefinition = {
  fields?: unknown[];
};

type ExistingIndex = {
  name: string;
  latestDefinition?: ExistingIndexDefinition;
  definition?: ExistingIndexDefinition;
};

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

/**
 * Deep equality check for objects and arrays
 * Handles key order differences in objects
 */
function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return false;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const o1 = obj1 as Record<string, unknown>;
  const o2 = obj2 as Record<string, unknown>;

  const keys1 = Object.keys(o1);
  const keys2 = Object.keys(o2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(o2, key)) return false;
    if (!deepEqual(o1[key], o2[key])) return false;
  }

  return true;
}

/**
 * Compares two index definitions to determine if they're equivalent
 */
function areIndexDefinitionsEqual(
  existing: ExistingIndex,
  desired: AtlasVectorIndexDefinition
): boolean {
  try {
    // Extract the definition from existing index
    const existingDef = existing.latestDefinition || existing.definition;

    if (!existingDef) {
      return false;
    }

    // Compare fields arrays
    const existingFields = existingDef.fields || [];
    const desiredFields = desired.definition.fields;

    if (existingFields.length !== desiredFields.length) {
      return false;
    }

    // Check if all desired fields exist in the existing index
    // Using deepEqual to handle object comparison within the array
    for (const desiredField of desiredFields) {
      const matchFound = existingFields.some((existingField) =>
        deepEqual(existingField, desiredField)
      );

      if (!matchFound) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn("⚠️  Error comparing index definitions:", error);
    return false;
  }
}

/**
 * Creates or updates a single vector search index
 */
async function ensureIndex(
  collection: Collection,
  indexDef: AtlasVectorIndexDefinition
): Promise<void> {
  try {
    // List all search indexes for this collection
    const indexes = await collection.listSearchIndexes().toArray();

    // Check if index exists
    const existingIndex = indexes.find(
      (idx: unknown) => (idx as ExistingIndex).name === indexDef.name
    ) as ExistingIndex | undefined;

    if (existingIndex) {
      console.log(`ℹ️  Index "${indexDef.name}" already exists`);

      // Compare definitions
      const isEqual = areIndexDefinitionsEqual(existingIndex, indexDef);

      if (isEqual) {
        console.log(`✅ Index "${indexDef.name}" definition matches`);
      } else {
        console.warn(`⚠️  Index "${indexDef.name}" definition differs!`);
        console.warn(
          "   Existing definition:",
          JSON.stringify(
            existingIndex.latestDefinition || existingIndex.definition,
            null,
            2
          )
        );
        console.warn(
          "   Desired definition:",
          JSON.stringify(indexDef.definition, null, 2)
        );
        console.warn(
          "   To update, please drop the index via Atlas UI and re-run this script"
        );
      }
      return;
    }

    // Create new index
    console.log(`🔨 Creating index "${indexDef.name}"...`);

    const indexSpec = {
      name: indexDef.name,
      type: indexDef.type,
      definition: indexDef.definition,
    };

    await collection.createSearchIndex(indexSpec);

    console.log(`✅ Index "${indexDef.name}" created successfully!`);
    console.log("⏳ Note: Index building may take a few minutes in Atlas");
    console.log("   Check Atlas UI for index status");
  } catch (error) {
    console.error(`❌ Failed to ensure index "${indexDef.name}":`, error);
    throw error;
  }
}

/**
 * Compares two Atlas Search index definitions to determine if they're equivalent
 */
function areSearchIndexDefinitionsEqual(
  existing: ExistingIndex,
  desired: AtlasSearchIndexDefinition
): boolean {
  try {
    // Extract the definition from existing index
    const existingDef = existing.latestDefinition || existing.definition;

    if (!existingDef) {
      return false;
    }

    // Use deepEqual to compare the full definition object (mappings, etc.)
    // This handles key order differences in the fields object
    return deepEqual(existingDef, desired.definition);
  } catch (error) {
    console.warn("⚠️  Error comparing search index definitions:", error);
    return false;
  }
}

/**
 * Creates or updates a single Atlas Search index (text search)
 */
async function ensureSearchIndex(
  collection: Collection,
  indexDef: AtlasSearchIndexDefinition
): Promise<void> {
  try {
    // List all search indexes for this collection
    const indexes = await collection.listSearchIndexes().toArray();

    // Check if index exists
    const existingIndex = indexes.find(
      (idx: unknown) => (idx as ExistingIndex).name === indexDef.name
    ) as ExistingIndex | undefined;

    if (existingIndex) {
      console.log(`ℹ️  Search Index "${indexDef.name}" already exists`);

      // Compare definitions
      const isEqual = areSearchIndexDefinitionsEqual(existingIndex, indexDef);

      if (isEqual) {
        console.log(`✅ Search Index "${indexDef.name}" definition matches`);
      } else {
        console.warn(`⚠️  Search Index "${indexDef.name}" definition differs!`);
        console.warn(
          "   Existing definition:",
          JSON.stringify(
            existingIndex.latestDefinition || existingIndex.definition,
            null,
            2
          )
        );
        console.warn(
          "   Desired definition:",
          JSON.stringify(indexDef.definition, null, 2)
        );
        console.warn(
          "   To update, please drop the index via Atlas UI and re-run this script"
        );
      }
      return;
    }

    // Create new index
    console.log(`🔨 Creating search index "${indexDef.name}"...`);

    const indexSpec = {
      name: indexDef.name,
      type: indexDef.type,
      definition: indexDef.definition,
    };

    await collection.createSearchIndex(indexSpec);

    console.log(`✅ Search Index "${indexDef.name}" created successfully!`);
    console.log("⏳ Note: Index building may take a few minutes in Atlas");
    console.log("   Check Atlas UI for index status");
  } catch (error) {
    console.error(
      `❌ Failed to ensure search index "${indexDef.name}":`,
      error
    );
    throw error;
  }
}

/**
 * Creates or updates a single standard MongoDB index
 */
async function ensureStandardIndex(
  collection: Collection,
  indexDef: StandardIndexDefinition
): Promise<void> {
  try {
    // List all indexes for this collection
    const indexes = await collection.indexes();

    // Check if index exists
    const existingIndex = indexes.find((idx) => idx.name === indexDef.name);

    if (existingIndex) {
      console.log(`ℹ️  Standard Index "${indexDef.name}" already exists`);

      // Basic check for TTL index
      if (
        indexDef.options?.expireAfterSeconds !== undefined &&
        existingIndex.expireAfterSeconds !== indexDef.options.expireAfterSeconds
      ) {
        console.warn(
          `⚠️  Standard Index "${indexDef.name}" definition differs!`
        );
        console.warn(
          `   Existing expireAfterSeconds: ${existingIndex.expireAfterSeconds}`
        );
        console.warn(
          `   Desired expireAfterSeconds: ${indexDef.options.expireAfterSeconds}`
        );
        console.warn(
          "   To update, please drop the index via Atlas UI and re-run this script"
        );
      } else {
        console.log(`✅ Standard Index "${indexDef.name}" definition matches`);
      }
      return;
    }

    // Create new index
    console.log(`🔨 Creating standard index "${indexDef.name}"...`);

    await collection.createIndex(indexDef.indexSpec, {
      name: indexDef.name,
      ...indexDef.options,
    });

    console.log(`✅ Standard Index "${indexDef.name}" created successfully!`);
  } catch (error) {
    console.error(
      `❌ Failed to ensure standard index "${indexDef.name}":`,
      error
    );
    throw error;
  }
}

/**
 * Main function to set up all indexes
 */
async function setupIndexes() {
  const client = new MongoClient(DATABASE_URL);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db = client.db();

    // Group indexes by collection for efficient processing
    const vectorIndexesByCollection = new Map<
      string,
      AtlasVectorIndexDefinition[]
    >();
    for (const indexDef of atlasIndexes) {
      const existing = vectorIndexesByCollection.get(indexDef.collection) || [];
      existing.push(indexDef);
      vectorIndexesByCollection.set(indexDef.collection, existing);
    }

    const searchIndexesByCollection = new Map<
      string,
      AtlasSearchIndexDefinition[]
    >();
    for (const indexDef of atlasSearchIndexes) {
      const existing = searchIndexesByCollection.get(indexDef.collection) || [];
      existing.push(indexDef);
      searchIndexesByCollection.set(indexDef.collection, existing);
    }

    const standardIndexesByCollection = new Map<
      string,
      StandardIndexDefinition[]
    >();
    for (const indexDef of standardIndexes) {
      const existing =
        standardIndexesByCollection.get(indexDef.collection) || [];
      existing.push(indexDef);
      standardIndexesByCollection.set(indexDef.collection, existing);
    }

    const allCollections = new Set([
      ...vectorIndexesByCollection.keys(),
      ...searchIndexesByCollection.keys(),
      ...standardIndexesByCollection.keys(),
    ]);

    console.log(
      `\n📋 Processing indexes across ${allCollections.size} collection(s)...\n`
    );

    // Process each collection's indexes
    for (const collectionName of allCollections) {
      console.log(`\n📦 Collection: ${collectionName}`);
      const collection = db.collection(collectionName);

      const vectorIndexes = vectorIndexesByCollection.get(collectionName) || [];
      for (const indexDef of vectorIndexes) {
        await ensureIndex(collection, indexDef);
      }

      const searchIndexes = searchIndexesByCollection.get(collectionName) || [];
      for (const indexDef of searchIndexes) {
        await ensureSearchIndex(collection, indexDef);
      }

      const stdIndexes = standardIndexesByCollection.get(collectionName) || [];
      for (const indexDef of stdIndexes) {
        await ensureStandardIndex(collection, indexDef);
      }
    }

    console.log("\n✅ All indexes processed successfully!");
  } catch (error) {
    console.error("\n❌ Failed to setup indexes:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

// Run the script
setupIndexes();
