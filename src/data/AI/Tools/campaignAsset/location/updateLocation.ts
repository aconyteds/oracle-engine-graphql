import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  getCampaignAssetById,
  stringifyCampaignAsset,
  updateCampaignAsset,
  verifyCampaignAssetOwnership,
} from "../../../../MongoDB";
import { locationDataSchema } from "../../../../MongoDB/campaignAsset/models";
import type { RequestContext, ToolConfig } from "../../../types";

const updateLocationSchema = z.object({
  locationId: z
    .string()
    .describe("ID of location to update (from search/previous calls)"),
  name: z.string().min(2).max(200).optional().describe("Updated name"),
  gmSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated Game Master (GM) summary"),
  gmNotes: z.string().optional().describe("Updated GM notes"),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated player summary"),
  playerNotes: z.string().optional().describe("Updated player notes"),
  locationData: locationDataSchema
    .partial()
    .optional()
    .describe("Updated fields. Only include fields to change."),
});

type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export async function updateLocation(
  rawInput: UpdateLocationInput,
  config: ToolConfig
): Promise<string> {
  const input = updateLocationSchema.parse(rawInput);
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

    const asset = await updateCampaignAsset({
      assetId: input.locationId,
      recordType: RecordType.Location,
      name: input.name,
      gmSummary: input.gmSummary,
      gmNotes: input.gmNotes,
      playerSummary: input.playerSummary,
      playerNotes: input.playerNotes,
      locationData: input.locationData,
    });

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<success>Location updated successfully!</success><location id="${asset.id}" name="${asset.name}">${assetDetails}</location>`;
  } catch (error) {
    console.error("Error in updateLocation tool:", error);

    if (error instanceof Error && error.message.includes("not authorized")) {
      return "<error>You are not authorized to update this location.</error>";
    }
    if (error instanceof Error && error.message.includes("type mismatch")) {
      return "<error>The specified asset is not a location.</error>";
    }
    return "<error>Failed to update location.</error>";
  }
}

export const updateLocationTool = tool(updateLocation, {
  name: "update_location",
  description:
    "Updates existing location asset. Only provide fields that should change. Confirm changes with user before updating.",
  schema: updateLocationSchema,
});
