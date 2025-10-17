import { UnauthorizedError } from "../../graphql/errors";
import { DBClient } from "./client";

export const verifyCampaignOwnership = async (
  campaignId: string,
  userId: string
): Promise<true> => {
  try {
    await DBClient.campaign.findUniqueOrThrow({
      where: {
        id: campaignId,
        ownerId: userId,
      },
    });

    return true;
  } catch {
    throw UnauthorizedError();
  }
};
