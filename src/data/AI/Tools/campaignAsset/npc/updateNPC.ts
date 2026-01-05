import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  getCampaignAssetById,
  stringifyCampaignAsset,
  updateCampaignAsset,
  verifyCampaignAssetOwnership,
} from "../../../../MongoDB";
import { npcDataSchema } from "../../../../MongoDB/campaignAsset/models";
import { MessageFactory } from "../../../messageFactory";
import type { RequestContext, ToolConfig } from "../../../types";

const updateNPCSchema = z.object({
  npcId: z
    .string()
    .describe(
      "ID of the NPC to update (from previous search or creation results)"
    ),
  name: z
    .string()
    .min(2)
    .max(200)
    .optional()
    .describe("Updated name (maximum 200 characters)"),
  gmSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated Game Master (GM) summary (maximum 200 characters)"),
  gmNotes: z.string().optional().describe("Updated GM notes"),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated player-facing summary (maximum 200 characters)"),
  playerNotes: z.string().optional().describe("Updated player notes"),
  npcData: npcDataSchema
    .partial()
    .optional()
    .describe(
      "Updated NPC data fields. Only include fields you want to change. Available fields: imageUrl, physicalDescription, motivation, mannerisms"
    ),
});

type UpdateNPCInput = z.infer<typeof updateNPCSchema>;

export async function updateNPC(
  rawInput: UpdateNPCInput,
  config: ToolConfig
): Promise<string> {
  const input = updateNPCSchema.parse(rawInput);
  const context = config.context as RequestContext;
  const { yieldMessage } = context;

  try {
    await verifyCampaignAssetOwnership(input.npcId, context.userId);

    const existingAsset = await getCampaignAssetById({
      assetId: input.npcId,
      recordType: RecordType.NPC,
    });

    if (!existingAsset) {
      return `<error>NPC with ID "${input.npcId}" not found or is not an NPC.</error>`;
    }

    yieldMessage(
      MessageFactory.progress(`Updating NPC "${existingAsset.name}"...`)
    );

    const asset = await updateCampaignAsset({
      assetId: input.npcId,
      recordType: RecordType.NPC,
      name: input.name,
      gmSummary: input.gmSummary,
      gmNotes: input.gmNotes,
      playerSummary: input.playerSummary,
      playerNotes: input.playerNotes,
      npcData: input.npcData,
    });
    yieldMessage(MessageFactory.assetUpdated("NPC", asset.id, asset.name));

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<success>NPC updated successfully!</success><npc id="${asset.id}" name="${asset.name}">${assetDetails}</npc>`;
  } catch (error) {
    console.error("Error in updateNPC tool:", error);

    yieldMessage(MessageFactory.error("Failed to update NPC"));

    if (error instanceof Error && error.message.includes("not authorized")) {
      return "<error>You are not authorized to update this NPC.</error>";
    }
    if (error instanceof Error && error.message.includes("type mismatch")) {
      return "<error>The specified asset is not an NPC.</error>";
    }
    return "<error>Failed to update NPC.</error>";
  }
}

export const updateNPCTool = tool(updateNPC, {
  name: "update_npc",
  description:
    "Updates an existing NPC asset. Only provide fields you want to change. Use to reflect character development, new player discoveries, or campaign progression.",
  schema: updateNPCSchema,
});
