import type { Campaign } from "../../../data/MongoDB";
import { DBClient } from "../../../data/MongoDB";

export const getLastSelectedCampaign = async (
  userId: string
): Promise<Campaign | null> => {
  const user = await DBClient.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      lastCampaignId: true,
    },
  });

  if (!user || !user.lastCampaignId) {
    return null;
  }

  const campaign = await DBClient.campaign.findUnique({
    where: {
      id: user.lastCampaignId,
    },
  });

  return campaign;
};
