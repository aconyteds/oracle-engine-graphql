import type { Campaign } from "../../../data/MongoDB";
import { DBClient } from "../../../data/MongoDB";

export const getCampaign = async (
  campaignId: string
): Promise<Campaign | null> => {
  const campaign = await DBClient.campaign.findUnique({
    where: {
      id: campaignId,
    },
  });

  if (!campaign) {
    return null;
  }

  return campaign;
};
