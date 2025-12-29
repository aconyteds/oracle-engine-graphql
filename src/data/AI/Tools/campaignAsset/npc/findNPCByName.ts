import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  findCampaignAssetByName,
  stringifyCampaignAsset,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const findNPCByNameSchema = z.object({
  name: z
    .string()
    .describe(
      "The exact name of the NPC to find. Must match the NPC's name exactly (case-sensitive)."
    ),
});

type FindNPCByNameInput = z.infer<typeof findNPCByNameSchema>;

export async function findNPCByName(
  rawInput: FindNPCByNameInput,
  config: ToolConfig
): Promise<string> {
  const input = findNPCByNameSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    const asset = await findCampaignAssetByName({
      campaignId: context.campaignId,
      name: input.name,
      recordType: RecordType.NPC,
    });

    if (!asset) {
      return `<result>No NPC found with exact name "${input.name}". Consider using find_campaign_asset for semantic search if you're not sure of the exact name.</result>`;
    }

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<npc id="${asset.id}" name="${asset.name}">${assetDetails}</npc>`;
  } catch (error) {
    console.error("Error in findNPCByName tool:", error);
    return "<error>An error occurred while searching for the NPC by name.</error>";
  }
}

export const findNPCByNameTool = tool(findNPCByName, {
  name: "find_npc_by_name",
  description:
    "Finds an NPC by exact name match. Use when you know the precise name of the NPC. For fuzzy/semantic search (e.g., 'the old wizard'), use find_campaign_asset instead.",
  schema: findNPCByNameSchema,
});
