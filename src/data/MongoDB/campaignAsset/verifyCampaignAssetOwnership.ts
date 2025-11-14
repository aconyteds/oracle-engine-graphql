import { UnauthorizedError } from "../../../graphql/errors";
import { DBClient } from "../client";

export const verifyCampaignAssetOwnership = async (
  assetId: string,
  userId: string
): Promise<true> => {
  try {
    const asset = await DBClient.campaignAsset.findUniqueOrThrow({
      where: {
        id: assetId,
      },
      include: {
        campaign: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    // Verify the user owns the campaign that contains this asset
    if (asset.campaign.ownerId !== userId) {
      throw UnauthorizedError();
    }

    return true;
  } catch (error) {
    // If it's already an UnauthorizedError, rethrow it
    if (
      error instanceof Error &&
      error.message.includes("not authorized to view this resource")
    ) {
      throw error;
    }
    // Otherwise, throw a generic unauthorized error
    throw UnauthorizedError();
  }
};
