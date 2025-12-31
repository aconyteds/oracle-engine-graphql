import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  findCampaignAssetByName,
  stringifyCampaignAsset,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const findPlotByNameSchema = z.object({
  name: z
    .string()
    .describe(
      "The exact name of the plot to find. Must match the plot's name exactly (case-sensitive)."
    ),
});

type FindPlotByNameInput = z.infer<typeof findPlotByNameSchema>;

export async function findPlotByName(
  rawInput: FindPlotByNameInput,
  config: ToolConfig
): Promise<string> {
  const input = findPlotByNameSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    const asset = await findCampaignAssetByName({
      campaignId: context.campaignId,
      name: input.name,
      recordType: RecordType.Plot,
    });

    if (!asset) {
      return `<result>No plot found with exact name "${input.name}". Consider using find_campaign_asset for semantic search if you're not sure of the exact name.</result>`;
    }

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<plot id="${asset.id}" name="${asset.name}">${assetDetails}</plot>`;
  } catch (error) {
    console.error("Error in findPlotByName tool:", error);
    return "<error>An error occurred while searching for the plot by name.</error>";
  }
}

export const findPlotByNameTool = tool(findPlotByName, {
  name: "find_plot_by_name",
  description:
    "Finds a plot by exact name match. Use when you know the precise name of the plot/quest/story arc. For fuzzy/semantic search (e.g., 'the missing prince quest'), use find_campaign_asset instead.",
  schema: findPlotByNameSchema,
});
