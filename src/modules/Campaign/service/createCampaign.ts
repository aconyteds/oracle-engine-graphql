import type { Campaign } from "../../../data/MongoDB";
import { DBClient } from "../../../data/MongoDB";
import { InvalidInput } from "../../../graphql/errors";
import { checkCampaignNameExists } from "./checkCampaignNameExists";
import { getLastSelectedCampaign } from "./getLastSelectedCampaign";
import { selectCampaign } from "./selectCampaign";

export interface CreateCampaignParams {
  ownerId: string;
  name: string;
  setting: string;
  tone: string;
  ruleset: string;
}

export const createCampaign = async (
  params: CreateCampaignParams
): Promise<Campaign> => {
  // Check if campaign name already exists for this user
  const nameExists = await checkCampaignNameExists({
    ownerId: params.ownerId,
    name: params.name,
  });

  if (nameExists) {
    throw InvalidInput(
      `A campaign with the name "${params.name}" already exists`
    );
  }

  const campaign = await DBClient.campaign.create({
    data: {
      ownerId: params.ownerId,
      name: params.name,
      setting: params.setting,
      tone: params.tone,
      ruleset: params.ruleset,
    },
  });

  // Check if the user has a selected campaign
  const hasCampaign = await getLastSelectedCampaign(params.ownerId);

  if (!hasCampaign) {
    // If not, set this campaign as the selected campaign
    await selectCampaign(campaign.id, params.ownerId);
  }

  return campaign;
};
