import { type Campaign, DBClient } from "../../../data/MongoDB";
import { InvalidInput } from "../../../graphql/errors";
import { checkCampaignNameExists } from "./checkCampaignNameExists";

export interface UpdateCampaignParams {
  campaignId: string;
  name?: string;
  setting?: string;
  tone?: string;
  ruleset?: string;
}

export const updateCampaign = async (
  params: UpdateCampaignParams
): Promise<Campaign> => {
  const { campaignId, ...updateData } = params;

  // Filter out undefined values
  const data = Object.fromEntries(
    Object.entries(updateData).filter(([_, value]) => value !== undefined)
  );

  console.log("Update data:", data);
  // Get the current campaign to find the owner
  const currentCampaign = await DBClient.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!currentCampaign) {
    throw InvalidInput("Campaign not found");
  }

  // If updating the name, check if it already exists for this user
  if (data.name && data.name !== currentCampaign.name) {
    // Check if the new name already exists for this user
    const nameExists = await checkCampaignNameExists({
      ownerId: currentCampaign.ownerId,
      name: data.name as string,
    });

    if (nameExists) {
      throw InvalidInput(
        `A campaign with the name "${data.name}" already exists`
      );
    }
  }

  const campaign = await DBClient.campaign.update({
    where: {
      id: campaignId,
    },
    data,
  });

  return campaign;
};
