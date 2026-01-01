/**
 * MongoDB Atlas Search Index Definitions (Non-Vector)
 *
 * This file contains type-safe definitions for Atlas Search indexes (text search).
 * Indexes defined here are automatically created/updated by the setup-indexes.ts script.
 */

export interface AtlasSearchField {
  type: "string";
  analyzer: "lucene.standard" | "lucene.english";
}

export interface AtlasSearchFilterField {
  type: "objectId";
}

export interface AtlasSearchIndexDefinition {
  /**
   * The name of the index in MongoDB Atlas
   */
  name: string;

  /**
   * The collection this index applies to
   */
  collection: string;

  /**
   * The type of index (search for text-based search)
   */
  type: "search";

  /**
   * The index definition with fields configuration
   */
  definition: {
    mappings: {
      dynamic: boolean;
      fields: {
        [fieldName: string]: AtlasSearchField | AtlasSearchFilterField;
      };
    };
  };
}

/**
 * Campaign Asset Text Search Index
 *
 * Enables keyword-based full-text search over campaign assets.
 * Searches across name, gmSummary, and gmNotes fields.
 *
 * Uses lucene.standard analyzer for general-purpose text matching.
 * Filters by campaignId to scope search to specific campaigns.
 */
export const campaignAssetSearchIndex: AtlasSearchIndexDefinition = {
  name: "gm_asset_search",
  collection: "CampaignAsset",
  type: "search",
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        name: {
          type: "string",
          analyzer: "lucene.standard",
        },
        gmSummary: {
          type: "string",
          analyzer: "lucene.standard",
        },
        gmNotes: {
          type: "string",
          analyzer: "lucene.standard",
        },
        campaignId: {
          type: "objectId",
        },
      },
    },
  },
};

/**
 * All Atlas Search Indexes
 *
 * Add new index definitions to this array to have them automatically
 * created/updated by the setup script.
 */
export const atlasSearchIndexes: AtlasSearchIndexDefinition[] = [
  campaignAssetSearchIndex,
  // Add more indexes here as needed
];
