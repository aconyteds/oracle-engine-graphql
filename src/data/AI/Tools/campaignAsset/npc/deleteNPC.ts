import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  deleteCampaignAsset,
  getCampaignAssetById,
  verifyCampaignAssetOwnership,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const deleteNPCSchema = z.object({
  npcId: z
    .string()
    .describe(
      "ID of the NPC to delete (from previous search or creation results)"
    ),
});

type DeleteNPCInput = z.infer<typeof deleteNPCSchema>;

export async function deleteNPC(
  rawInput: DeleteNPCInput,
  config: ToolConfig
): Promise<string> {
  const input = deleteNPCSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    await verifyCampaignAssetOwnership(input.npcId, context.userId);

    const existingAsset = await getCampaignAssetById({
      assetId: input.npcId,
      recordType: RecordType.NPC,
    });

    if (!existingAsset) {
      return `<error>NPC with ID "${input.npcId}" not found or is not an NPC.</error>`;
    }

    // HITL middleware will intercept if allowEdits: false
    const result = await deleteCampaignAsset({
      assetId: input.npcId,
    });

    if (result.success) {
      return `<success>NPC "${existingAsset.name}" (ID: ${input.npcId}) permanently deleted.</success>`;
    }
    return "<error>Failed to delete NPC.</error>";
  } catch (error) {
    console.error("Error in deleteNPC tool:", error);

    if (error instanceof Error && error.message.includes("not authorized")) {
      return "<error>You are not authorized to delete this NPC.</error>";
    }
    return "<error>Failed to delete NPC.</error>";
  }
}

export const deleteNPCTool = tool(deleteNPC, {
  name: "delete_npc",
  description:
    "PERMANENTLY deletes an NPC asset and removes all references. This action CANNOT BE UNDONE. Always confirm with user before deletion. May require approval based on user settings.",
  schema: deleteNPCSchema,
});
