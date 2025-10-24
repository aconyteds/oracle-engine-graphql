import { DBClient, type User } from "../../../data/MongoDB";

export const selectCampaign = async (
  userId: string,
  campaignId: string
): Promise<User> => {
  const user = await DBClient.user.update({
    where: {
      id: userId,
    },
    data: {
      lastCampaignId: campaignId,
    },
  });

  return user;
};
