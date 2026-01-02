import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchCampaignAssets, stringifyCampaignAsset } from "../../../MongoDB";
import { RequestContext } from "../../types";

const findCampaignAssetSchema = z
  .object({
    query: z
      .string()
      .optional()
      .describe(
        "Natural language description for semantic search (e.g., 'the old wizard who lives in the tower'). Use for conceptual/thematic searches."
      ),
    keywords: z
      .string()
      .optional()
      .describe(
        "Specific keywords or name fragments for text-based search (e.g., 'Gandalf', 'Dragon Tavern'). Use for name-based or keyword searches. Supports fuzzy matching and partial names."
      ),
    recordType: z
      .enum(["NPC", "Location", "Plot"])
      .optional()
      .describe(
        "Optional filter by asset type. If not provided, searches all asset types."
      ),
  })
  .refine((data) => data.query || data.keywords, {
    message: "Either 'query' or 'keywords' must be provided",
  });

export const findCampaignAsset = tool(
  async (rawInput, config): Promise<string> => {
    const input = findCampaignAssetSchema.parse(rawInput);
    const context = config.context as RequestContext;

    try {
      const results = await searchCampaignAssets({
        campaignId: context.campaignId,
        query: input.query,
        keywords: input.keywords,
        limit: 10,
        minScore: 0.6,
        recordType: input.recordType,
      });

      const { assets } = results;

      if (assets.length === 0) {
        return "No relevant campaign assets found.";
      }

      // Format results into a string
      let responseString = "";
      for (const asset of assets) {
        const assetDetails = await stringifyCampaignAsset(asset);
        responseString += `<asset id="${asset.id}" type="${asset.recordType}">${assetDetails}</asset>`;
      }
      return responseString;
    } catch (error) {
      console.error("Error in findCampaignAsset tool:", error);
      return "An error occurred while searching for campaign assets.";
    }
  },
  {
    name: "find_campaign_asset",
    description: `Searches campaign assets using semantic understanding and/or keyword matching.

SEARCH STRATEGIES:
- Use 'query' only: Semantic search for conceptual matches (e.g., "characters who can cast fire magic")
- Use 'keywords' only: Name-based or keyword search with fuzzy matching (e.g., "Gandalf" will find "Gandalf the Grey")
- Use both: Hybrid search combining semantic relevance with keyword precision

EXAMPLES:
- Finding by name (exact or partial): keywords="Elara" or keywords="Tower Wizard"
- Finding by description: query="the innkeeper who knows about the missing prince"
- Finding with both: query="fire mage", keywords="red robes"

Returns up to 10 most relevant assets with detailed information.`,
    schema: findCampaignAssetSchema,
  }
);
