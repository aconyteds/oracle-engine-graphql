import { CampaignAsset, RecordType } from "@prisma/client";
import { z } from "zod";
import { DBClient } from "../client";

const getCampaignAssetByIdSchema = z.object({
  assetId: z
    .string()
    .describe("The MongoDB ObjectId of the campaign asset to retrieve."),
  recordType: z
    .enum(RecordType)
    .optional()
    .describe(
      "Optional record type to verify the asset matches the expected type."
    ),
});

export async function getCampaignAssetById(
  input: z.infer<typeof getCampaignAssetByIdSchema>
): Promise<CampaignAsset | null> {
  const params = getCampaignAssetByIdSchema.parse(input);

  try {
    const asset = await DBClient.campaignAsset.findUnique({
      where: { id: params.assetId },
    });

    if (!asset) {
      return null;
    }

    // If recordType is provided, verify it matches
    if (params.recordType && asset.recordType !== params.recordType) {
      console.error("Asset type mismatch:", {
        assetId: params.assetId,
        expected: params.recordType,
        actual: asset.recordType,
      });
      throw new Error(
        `Asset type mismatch: expected ${params.recordType}, got ${asset.recordType}`
      );
    }

    return asset;
  } catch (error) {
    // Re-throw if it's our custom error
    if (error instanceof Error && error.message.includes("type mismatch")) {
      throw error;
    }

    console.error("Failed to retrieve campaign asset:", {
      assetId: params.assetId,
      error,
    });
    throw new Error(`Failed to retrieve campaign asset: ${params.assetId}`);
  }
}
