import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  findCampaignAssetByName,
  stringifyCampaignAsset,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const findLocationByNameSchema = z.object({
  name: z
    .string()
    .describe("The exact name of the location to find. Must match exactly."),
});

type FindLocationByNameInput = z.infer<typeof findLocationByNameSchema>;

export async function findLocationByName(
  rawInput: FindLocationByNameInput,
  config: ToolConfig
): Promise<string> {
  const input = findLocationByNameSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    const asset = await findCampaignAssetByName({
      campaignId: context.campaignId,
      name: input.name,
      recordType: RecordType.Location,
    });

    if (!asset) {
      return `<result>No location found with exact name "${input.name}". Consider using find_campaign_asset for semantic search.</result>`;
    }

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<location id="${asset.id}" name="${asset.name}">${assetDetails}</location>`;
  } catch (error) {
    console.error("Error in findLocationByName tool:", error);
    return "<error>An error occurred while searching for the location by name.</error>";
  }
}

export const findLocationByNameTool = tool(findLocationByName, {
  name: "find_location_by_name",
  description:
    "Finds a location by exact name match. Use when you know the precise name. For fuzzy/semantic search, use find_campaign_asset instead.",
  schema: findLocationByNameSchema,
});
