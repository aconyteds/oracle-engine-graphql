import { DBClient } from "../../../data/MongoDB";

export interface CheckCampaignNameExistsParams {
  ownerId: string;
  name: string;
}

export const checkCampaignNameExists = async (
  params: CheckCampaignNameExistsParams
): Promise<boolean> => {
  const campaign = await DBClient.campaign.findUnique({
    where: {
      ownerId_name: {
        ownerId: params.ownerId,
        name: params.name,
      },
    },
  });

  return campaign !== null;
};
