import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";
import {
  verifyCampaignAssetOwnership,
  verifyCampaignOwnership,
} from "../../data/MongoDB";
import {
  createCampaignAsset,
  deleteCampaignAsset,
  getCampaignAssetById,
  listCampaignAssets,
  updateCampaignAsset,
} from "../../data/MongoDB/campaignAsset";
import { InvalidInput, InvalidUserCredentials } from "../../graphql/errors";
import type { CampaignAssetModule } from "./generated";
import { searchCampaignAssets } from "./services";
import {
  translateCampaignAsset,
  translateCampaignAssetData,
  translateCreateInput,
  translateUpdateInput,
} from "./translators";

const CampaignAssetResolvers: CampaignAssetModule.Resolvers = {
  Query: {
    getCampaignAsset: async (
      _,
      { input },
      { user }
    ): Promise<CampaignAssetModule.GetCampaignAssetPayload | null> => {
      if (!user) {
        throw InvalidUserCredentials();
      }

      // Verify user owns the campaign that contains this asset
      await verifyCampaignAssetOwnership(input.assetId, user.id);

      const asset = await getCampaignAssetById({
        assetId: input.assetId,
        recordType: input.recordType ?? undefined,
      });

      // Return null if asset not found
      if (!asset) {
        return { asset: null };
      }

      // Translate database model to GraphQL type
      return {
        asset: translateCampaignAsset(asset),
      };
    },

    listCampaignAssets: async (
      _,
      { input },
      { user }
    ): Promise<CampaignAssetModule.ListCampaignAssetsPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }

      // Verify user owns the campaign
      await verifyCampaignOwnership(input.campaignId, user.id);

      const assets = await listCampaignAssets({
        campaignId: input.campaignId,
        recordType: input.recordType ?? undefined,
        limit: input.limit ?? undefined,
      });

      // Translate all database models to GraphQL types
      return {
        assets: assets.map(translateCampaignAsset),
      };
    },

    searchCampaignAssets: async (
      _,
      { input },
      { user }
    ): Promise<CampaignAssetModule.SearchCampaignAssetsPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }

      // Verify user owns the campaign
      await verifyCampaignOwnership(input.campaignId, user.id);

      const results = await searchCampaignAssets(input);

      // Transform results to include score
      return results;
    },
  },

  Mutation: {
    createCampaignAsset: async (
      _,
      { input },
      { user }
    ): Promise<CampaignAssetModule.CreateCampaignAssetPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }

      // Verify user owns the campaign
      await verifyCampaignOwnership(input.campaignId, user.id);

      // Validate that the correct data field is provided for the recordType
      switch (input.recordType) {
        case RecordType.Location:
          if (!input.locationData) {
            throw InvalidInput(
              "locationData is required when recordType is Location"
            );
          }
          if (input.npcData || input.plotData) {
            throw InvalidInput(
              "Only locationData should be provided for Location assets"
            );
          }
          break;
        case RecordType.NPC:
          if (!input.npcData) {
            throw InvalidInput("npcData is required when recordType is NPC");
          }
          if (input.locationData || input.plotData) {
            throw InvalidInput(
              "Only npcData should be provided for NPC assets"
            );
          }
          break;
        case RecordType.Plot:
          if (!input.plotData) {
            throw InvalidInput("plotData is required when recordType is Plot");
          }
          if (input.locationData || input.npcData) {
            throw InvalidInput(
              "Only plotData should be provided for Plot assets"
            );
          }
          break;
        default:
          throw InvalidInput(`Unsupported recordType: ${input.recordType}`);
      }

      // Translate GraphQL input to adapter input
      const adapterInput = translateCreateInput(input);

      // Create the asset using the universal adapter
      const asset = await createCampaignAsset(adapterInput);

      // Translate database model to GraphQL type
      return {
        asset: translateCampaignAsset(asset),
      };
    },

    updateCampaignAsset: async (
      _,
      { input },
      { user }
    ): Promise<CampaignAssetModule.UpdateCampaignAssetPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }

      // Verify user owns the campaign that contains this asset
      await verifyCampaignAssetOwnership(input.assetId, user.id);

      // Translate GraphQL input to adapter input
      const adapterInput = translateUpdateInput(input);

      // Update the asset using the universal adapter
      const asset = await updateCampaignAsset(adapterInput);

      // Translate database model to GraphQL type
      return {
        asset: translateCampaignAsset(asset),
      };
    },

    deleteCampaignAsset: async (
      _,
      { input },
      { user }
    ): Promise<CampaignAssetModule.DeleteCampaignAssetPayload> => {
      if (!user) {
        throw InvalidUserCredentials();
      }

      // Verify user owns the campaign that contains this asset
      await verifyCampaignAssetOwnership(input.assetId, user.id);

      // Delete the asset (returns simple success response, no translation needed)
      const result = await deleteCampaignAsset({
        assetId: input.assetId,
      });

      return result;
    },
  },

  // Field resolver for the polymorphic data field
  CampaignAsset: {
    data: (parent) => {
      // The parent.data contains the Prisma CampaignAsset passed from translateCampaignAsset
      // Extract it and use the translator to resolve the polymorphic data field
      const prismaAsset = parent.data as unknown as CampaignAsset;
      return translateCampaignAssetData(prismaAsset);
    },
  },
};

export default CampaignAssetResolvers;
