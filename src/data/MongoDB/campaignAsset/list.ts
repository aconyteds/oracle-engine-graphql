import { CampaignAsset, RecordType } from "@prisma/client";
import { z } from "zod";
import { DBClient } from "../client";

const listCampaignAssetsSchema = z.object({
  campaignId: z
    .string()
    .describe("The MongoDB ObjectId of the campaign to list assets for."),
  recordType: z
    .nativeEnum(RecordType)
    .optional()
    .describe("Optional filter to only return assets of a specific type."),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit on the number of assets to return."),
});

export async function listCampaignAssets(
  input: z.infer<typeof listCampaignAssetsSchema>
): Promise<CampaignAsset[]> {
  const params = listCampaignAssetsSchema.parse(input);

  try {
    // Build the where clause
    const whereClause: {
      campaignId: string;
      recordType?: RecordType;
    } = {
      campaignId: params.campaignId,
    };

    // Add recordType filter if provided
    if (params.recordType) {
      whereClause.recordType = params.recordType;
    }

    const assets = await DBClient.campaignAsset.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: "desc",
      },
      ...(params.limit && { take: params.limit }),
    });

    return assets;
  } catch (error) {
    console.error("Failed to list campaign assets:", {
      campaignId: params.campaignId,
      recordType: params.recordType,
      error,
    });
    throw new Error(
      `Failed to list campaign assets for campaign: ${params.campaignId}`
    );
  }
}
