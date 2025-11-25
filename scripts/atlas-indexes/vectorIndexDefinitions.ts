/**
 * MongoDB Atlas Search Index Definitions
 *
 * This file contains type-safe definitions for all Atlas Search indexes used in the application.
 * Indexes defined here are automatically created/updated by the setup-vector-indexes.ts script.
 */

export interface AtlasVectorField {
  type: "vector";
  path: string;
  numDimensions: number;
  similarity: "euclidean" | "cosine" | "dotProduct";
}

export interface AtlasFilterField {
  type: "filter";
  path: string;
}

export type AtlasIndexField = AtlasVectorField | AtlasFilterField;

export interface AtlasVectorIndexDefinition {
  /**
   * The name of the index in MongoDB Atlas
   */
  name: string;

  /**
   * The collection this index applies to
   */
  collection: string;

  /**
   * The type of index (vectorSearch for vector embeddings)
   */
  type: "vectorSearch";

  /**
   * The index definition with fields configuration
   */
  definition: {
    fields: AtlasIndexField[];
  };
}

/**
 * Campaign Asset Vector Search Index
 *
 * Enables semantic search over campaign assets (NPCs, Locations, Plots)
 * using OpenAI text-embedding-3-small embeddings (1536 dimensions).
 *
 * Filter fields allow pre-filtering by campaignId and recordType before vector search.
 */
export const campaignAssetVectorIndex: AtlasVectorIndexDefinition = {
  name: "campaign_asset_vector_index",
  collection: "CampaignAsset",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "Embeddings",
        numDimensions: 1536, // OpenAI text-embedding-3-small dimensions
        similarity: "cosine", // Cosine similarity for text embeddings
      },
      {
        type: "filter",
        path: "campaignId", // Pre-filter to campaign-specific assets
      },
      {
        type: "filter",
        path: "recordType", // Pre-filter by asset type (NPC, Location, Plot)
      },
    ],
  },
};

/**
 * All Atlas Search Indexes
 *
 * Add new index definitions to this array to have them automatically
 * created/updated by the setup script.
 */
export const atlasIndexes: AtlasVectorIndexDefinition[] = [
  campaignAssetVectorIndex,
  // Add more indexes here as needed
];
