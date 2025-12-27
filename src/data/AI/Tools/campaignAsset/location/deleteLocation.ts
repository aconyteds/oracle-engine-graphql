import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  deleteCampaignAsset,
  getCampaignAssetById,
  verifyCampaignAssetOwnership,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const deleteLocationSchema = z.object({
  locationId: z
    .string()
    .describe("ID of location to delete (from search/previous calls)"),
});

type DeleteLocationInput = z.infer<typeof deleteLocationSchema>;

export async function deleteLocation(
  rawInput: DeleteLocationInput,
  config: ToolConfig
): Promise<string> {
  const input = deleteLocationSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    await verifyCampaignAssetOwnership(input.locationId, context.userId);

    const existingAsset = await getCampaignAssetById({
      assetId: input.locationId,
      recordType: RecordType.Location,
    });

    if (!existingAsset) {
      return `<error>Location with ID "${input.locationId}" not found or is not a location.</error>`;
    }

    // HITL middleware will intercept if allowEdits: false
    const result = await deleteCampaignAsset({
      assetId: input.locationId,
    });

    if (result.success) {
      return `<success>Location "${existingAsset.name}" (ID: ${input.locationId}) permanently deleted.</success>`;
    }
    return "<error>Failed to delete location.</error>";
  } catch (error) {
    console.error("Error in deleteLocation tool:", error);

    if (error instanceof Error && error.message.includes("not authorized")) {
      return "<error>You are not authorized to delete this location.</error>";
    }
    return "<error>Failed to delete location.</error>";
  }
}

export const deleteLocationTool = tool(deleteLocation, {
  name: "delete_location",
  description:
    "PERMANENTLY deletes location asset and removes references. CANNOT BE UNDONE. Always confirm with user. May require approval based on settings.",
  schema: deleteLocationSchema,
});
