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

import { MongoClient } from "mongodb";
import {
  type AtlasVectorIndexDefinition,
  atlasIndexes,
} from "./atlas-indexes/vectorIndexDefinitions";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

/**
 * Compares two index definitions to determine if they're equivalent
 */
function areIndexDefinitionsEqual(
  existing: any,
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

    // Create comparison objects for deep equality check
    const existingFieldsNormalized = existingFields.map((field: any) =>
      JSON.stringify(field)
    );
    const desiredFieldsNormalized = desiredFields.map((field) =>
      JSON.stringify(field)
    );

    // Check if all desired fields exist in the existing index
    for (const desiredField of desiredFieldsNormalized) {
      if (!existingFieldsNormalized.includes(desiredField)) {
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
  collection: any,
  indexDef: AtlasVectorIndexDefinition
): Promise<void> {
  try {
    // List all search indexes for this collection
    const indexes = await collection.listSearchIndexes().toArray();

    // Check if index exists
    const existingIndex = indexes.find(
      (idx: any) => idx.name === indexDef.name
    );

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
 * Main function to set up all vector indexes
 */
async function setupVectorIndexes() {
  const client = new MongoClient(DATABASE_URL);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db = client.db();

    // Group indexes by collection for efficient processing
    const indexesByCollection = new Map<string, AtlasVectorIndexDefinition[]>();
    for (const indexDef of atlasIndexes) {
      const existing = indexesByCollection.get(indexDef.collection) || [];
      existing.push(indexDef);
      indexesByCollection.set(indexDef.collection, existing);
    }

    console.log(
      `\n📋 Processing ${atlasIndexes.length} index(es) across ${indexesByCollection.size} collection(s)...\n`
    );

    // Process each collection's indexes
    for (const [collectionName, indexes] of indexesByCollection) {
      console.log(`\n📦 Collection: ${collectionName}`);
      const collection = db.collection(collectionName);

      for (const indexDef of indexes) {
        await ensureIndex(collection, indexDef);
      }
    }

    console.log("\n✅ All indexes processed successfully!");
  } catch (error) {
    console.error("\n❌ Failed to setup vector indexes:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

// Run the script
setupVectorIndexes();
