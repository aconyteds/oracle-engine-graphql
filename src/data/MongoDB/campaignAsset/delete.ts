import { z } from "zod";
import { DBClient } from "../client";

const deleteCampaignAssetSchema = z.object({
  assetId: z
    .string()
    .describe("The MongoDB ObjectId of the campaign asset to delete."),
});

export interface DeleteCampaignAssetResult {
  success: boolean;
  assetId: string;
}

export async function deleteCampaignAsset(
  input: z.infer<typeof deleteCampaignAssetSchema>
): Promise<DeleteCampaignAssetResult> {
  const params = deleteCampaignAssetSchema.parse(input);

  try {
    // Check if the asset exists first
    const existingAsset = await DBClient.campaignAsset.findUnique({
      where: { id: params.assetId },
    });

    if (!existingAsset) {
      throw new Error(`Campaign asset with id ${params.assetId} not found`);
    }

    // Use a transaction to ensure both operations succeed or both fail
    await DBClient.$transaction(async (tx) => {
      // Find all SessionEvents that reference this asset
      // The relatedAssetList field is indexed, so this query will be fast
      const relatedSessionEvents = await tx.sessionEvent.findMany({
        where: {
          relatedAssetList: {
            has: params.assetId,
          },
        },
        select: {
          id: true,
          relatedAssetList: true,
        },
      });

      // Remove the asset ID from all SessionEvents that reference it
      if (relatedSessionEvents.length > 0) {
        // Update each SessionEvent to remove the asset ID from relatedAssetList
        await Promise.all(
          relatedSessionEvents.map((sessionEvent) =>
            tx.sessionEvent.update({
              where: { id: sessionEvent.id },
              data: {
                relatedAssetList: {
                  set: sessionEvent.relatedAssetList.filter(
                    (id) => id !== params.assetId
                  ),
                },
              },
            })
          )
        );
      }

      // Now delete the campaign asset
      await tx.campaignAsset.delete({
        where: { id: params.assetId },
      });
    });

    return {
      success: true,
      assetId: params.assetId,
    };
  } catch (error) {
    console.error("Failed to delete campaign asset:", {
      assetId: params.assetId,
      error,
    });

    // Re-throw if it's our custom error
    if (error instanceof Error && error.message.includes("not found")) {
      throw error;
    }

    // Otherwise throw a generic error
    throw new Error(`Failed to delete campaign asset: ${params.assetId}`);
  }
}
