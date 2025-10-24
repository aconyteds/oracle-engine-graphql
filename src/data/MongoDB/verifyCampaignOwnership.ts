import { UnauthorizedError } from "../../graphql/errors";
import { DBClient } from "./client";

export const verifyCampaignOwnership = async (
  campaignId: string,
  userId: string
): Promise<true> => {
  try {
    const campaign = await DBClient.campaign.findUniqueOrThrow({
      where: {
        id: campaignId,
      },
    });

    // Verify the user owns the campaign
    if (campaign.ownerId !== userId) {
      throw UnauthorizedError();
    }

    return true;
  } catch (error) {
    // If it's already an UnauthorizedError, rethrow it
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      throw error;
    }
    // Otherwise, throw a generic unauthorized error
    throw UnauthorizedError();
  }
};
