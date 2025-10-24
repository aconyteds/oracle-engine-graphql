import type { Campaign } from "../../../data/MongoDB";
import { DBClient } from "../../../data/MongoDB";

export const getUserCampaigns = async (userId: string): Promise<Campaign[]> => {
  const campaigns = await DBClient.campaign.findMany({
    where: {
      ownerId: userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return campaigns;
};
