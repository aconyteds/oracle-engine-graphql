import type { Campaign } from "../../../data/MongoDB";
import { DBClient } from "../../../data/MongoDB";
import { InvalidInput } from "../../../graphql/errors";
import { checkCampaignNameExists } from "./checkCampaignNameExists";

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

  // Use a transaction to create campaign and update user's lastCampaignId atomically
  const campaign = await DBClient.$transaction(async (tx) => {
    // Create the campaign
    const newCampaign = await tx.campaign.create({
      data: {
        ownerId: params.ownerId,
        name: params.name,
        setting: params.setting,
        tone: params.tone,
        ruleset: params.ruleset,
      },
    });

    // Always set the newly created campaign as the last selected campaign
    await tx.user.update({
      where: { id: params.ownerId },
      data: { lastCampaignId: newCampaign.id },
    });

    return newCampaign;
  });

  return campaign;
};
