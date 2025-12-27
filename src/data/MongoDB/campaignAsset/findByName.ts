import type { CampaignAsset, RecordType } from "@prisma/client";
import { z } from "zod";
import { DBClient } from "../client";

const findByNameSchema = z.object({
  campaignId: z.string().describe("The MongoDB ObjectId of the campaign"),
  name: z.string().describe("The exact name of the asset to find"),
  recordType: z
    .enum(["NPC", "Location", "Plot"])
    .optional()
    .describe("Optional filter by asset type"),
});

export async function findCampaignAssetByName(
  input: z.infer<typeof findByNameSchema>
): Promise<CampaignAsset | null> {
  const params = findByNameSchema.parse(input);

  try {
    // Build the where clause
    const whereClause: {
      campaignId: string;
      name: string;
      recordType?: RecordType;
    } = {
      campaignId: params.campaignId,
      name: params.name, // Exact match
    };

    if (params.recordType) {
      whereClause.recordType = params.recordType as RecordType;
    }

    const asset = await DBClient.campaignAsset.findFirst({
      where: whereClause,
    });

    return asset;
  } catch (error) {
    console.error("Failed to find campaign asset by name:", {
      campaignId: params.campaignId,
      name: params.name,
      error,
    });
    throw new Error(`Failed to find campaign asset by name: ${params.name}`);
  }
}
