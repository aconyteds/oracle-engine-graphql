import { verifyCampaignOwnership } from "../../data/MongoDB";
import { InvalidUserCredentials } from "../../graphql/errors";
import { TranslateCampaign } from "../utils";
import type { CampaignModule } from "./generated";
import {
  checkCampaignNameExists,
  createCampaign,
  getCampaign,
  getLastSelectedCampaign,
  getUserCampaigns,
  selectCampaign,
  updateCampaign,
} from "./service";

const CampaignResolvers: CampaignModule.Resolvers = {
  Query: {
    campaigns: async (_, __, { user }): Promise<CampaignModule.Campaign[]> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      const campaigns = await getUserCampaigns(user.id);
      return campaigns.map(TranslateCampaign);
    },
    getCampaign: async (
      _,
      { input: { campaignId } },
      { user }
    ): Promise<CampaignModule.GetCampaignPayload | null> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      await verifyCampaignOwnership(campaignId, user.id);
      const campaign = await getCampaign(campaignId);
      return {
        campaign: campaign ? TranslateCampaign(campaign) : null,
      };
    },
    checkCampaignNameExists: async (
      _,
      { input: { name } },
      { user }
    ): Promise<CampaignModule.CheckCampaignNameExistsPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      const exists = await checkCampaignNameExists({
        ownerId: user.id,
        name,
      });
      return {
        exists,
      };
    },
  },
  Mutation: {
    createCampaign: async (
      _,
      { input },
      { user }
    ): Promise<CampaignModule.CreateCampaignPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      const campaign = await createCampaign({
        ownerId: user.id,
        name: input.name,
        setting: input.setting,
        tone: input.tone,
        ruleset: input.ruleset,
      });
      return {
        campaign: TranslateCampaign(campaign),
      };
    },
    updateCampaign: async (
      _,
      { input },
      { user }
    ): Promise<CampaignModule.UpdateCampaignPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      await verifyCampaignOwnership(input.campaignId, user.id);
      const campaign = await updateCampaign({
        campaignId: input.campaignId,
        name: input.name ?? undefined,
        setting: input.setting ?? undefined,
        tone: input.tone ?? undefined,
        ruleset: input.ruleset ?? undefined,
      });
      return {
        campaign: TranslateCampaign(campaign),
      };
    },
    selectCampaign: async (
      _,
      { input: { campaignId } },
      { user }
    ): Promise<CampaignModule.SelectCampaignPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      await verifyCampaignOwnership(campaignId, user.id);
      const updatedUser = await selectCampaign(user.id, campaignId);
      const campaign = await getCampaign(campaignId);
      return {
        campaign: campaign ? TranslateCampaign(campaign) : null,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
        },
      };
    },
  },
  User: {
    campaigns: async (parent): Promise<CampaignModule.Campaign[]> => {
      if (!parent) {
        throw InvalidUserCredentials();
      }
      const campaigns = await getUserCampaigns(parent.id);
      return campaigns.map(TranslateCampaign);
    },
    lastSelectedCampaign: async (
      parent
    ): Promise<CampaignModule.Campaign | null> => {
      if (!parent) {
        throw InvalidUserCredentials();
      }
      const campaign = await getLastSelectedCampaign(parent.id);
      return campaign ? TranslateCampaign(campaign) : null;
    },
  },
};

export default CampaignResolvers;
