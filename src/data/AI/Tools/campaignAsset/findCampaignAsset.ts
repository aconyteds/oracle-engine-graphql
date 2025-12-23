import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchCampaignAssets, stringifyCampaignAsset } from "../../../MongoDB";
import { RequestContext } from "../../types";

const findCampaignAssetSchema = z.object({
  query: z
    .string()
    .describe(
      "An enriched string which will be used to find relevant campaign assets. This should be a summary of what the user is looking for."
    ),
  recordType: z
    .enum(["NPC", "Location", "Plot"])
    .optional()
    .describe(
      "Optional filter by asset type. If not provided, searches all asset types."
    ),
});

export const findCampaignAsset = tool(
  async (rawInput, config): Promise<string> => {
    const input = findCampaignAssetSchema.parse(rawInput);
    const context = config.context as RequestContext;

    try {
      const results = await searchCampaignAssets({
        campaignId: context.campaignId,
        query: input.query,
        limit: 5,
        minScore: 0.65,
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
    description:
      "Searches through campaign assets to find the most relevant items based on what the user is asking about. Will return relevant contextual information for each asset. Use to find assets related to locations, NPCs, or plots.",
    schema: findCampaignAssetSchema,
  }
);
