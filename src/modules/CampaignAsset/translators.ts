import type { CampaignAsset, RecordType } from "@prisma/client";
import type {
  createCampaignAsset,
  updateCampaignAsset,
} from "../../data/MongoDB/campaignAsset";
import type { CampaignAssetModule } from "./generated";

/**
 * Input Translators: GraphQL Input Types → Zod/Adapter Types
 */

/**
 * Translates GraphQL CreateCampaignAssetInput to the Zod schema input
 * for the createCampaignAsset adapter function.
 */
export function translateCreateInput(
  input: CampaignAssetModule.CreateCampaignAssetInput
): Parameters<typeof createCampaignAsset>[0] {
  const baseInput = {
    campaignId: input.campaignId,
    recordType: input.recordType as RecordType,
    name: input.name,
    summary: input.summary ?? "",
    playerSummary: input.playerSummary ?? "",
    sessionEventLink: [],
    relatedAssetList: [],
  };

  // Map type-specific data based on recordType
  switch (input.recordType) {
    case "Location":
      if (!input.locationData) {
        throw new Error("locationData is required for Location assets");
      }
      return {
        ...baseInput,
        locationData: {
          imageUrl: input.locationData.imageUrl,
          description: input.locationData.description,
          condition: input.locationData.condition,
          pointsOfInterest: input.locationData.pointsOfInterest,
          characters: input.locationData.characters,
          dmNotes: input.locationData.dmNotes,
          sharedWithPlayers: input.locationData.sharedWithPlayers,
        },
      } as Parameters<typeof createCampaignAsset>[0];

    case "NPC":
      if (!input.npcData) {
        throw new Error("npcData is required for NPC assets");
      }
      return {
        ...baseInput,
        npcData: {
          imageUrl: input.npcData.imageUrl,
          physicalDescription: input.npcData.physicalDescription,
          motivation: input.npcData.motivation,
          mannerisms: input.npcData.mannerisms,
          dmNotes: input.npcData.dmNotes,
          sharedWithPlayers: input.npcData.sharedWithPlayers,
        },
      } as Parameters<typeof createCampaignAsset>[0];

    case "Plot":
      if (!input.plotData) {
        throw new Error("plotData is required for Plot assets");
      }
      return {
        ...baseInput,
        plotData: {
          dmNotes: input.plotData.dmNotes,
          sharedWithPlayers: input.plotData.sharedWithPlayers,
          status: input.plotData.status,
          urgency: input.plotData.urgency,
        },
      } as Parameters<typeof createCampaignAsset>[0];

    default:
      throw new Error(`Unsupported recordType: ${input.recordType}`);
  }
}

/**
 * Translates GraphQL UpdateCampaignAssetInput to the Zod schema input
 * for the updateCampaignAsset adapter function.
 */
export function translateUpdateInput(
  input: CampaignAssetModule.UpdateCampaignAssetInput
): Parameters<typeof updateCampaignAsset>[0] {
  const baseInput = {
    assetId: input.assetId,
    recordType: input.recordType as RecordType,
    name: input.name ?? undefined,
    summary: input.summary ?? undefined,
    playerSummary: input.playerSummary ?? undefined,
  };

  // Map type-specific data based on recordType
  switch (input.recordType) {
    case "Location":
      return {
        ...baseInput,
        locationData: input.locationData
          ? {
              imageUrl: input.locationData.imageUrl,
              description: input.locationData.description,
              condition: input.locationData.condition,
              pointsOfInterest: input.locationData.pointsOfInterest,
              characters: input.locationData.characters,
              dmNotes: input.locationData.dmNotes,
              sharedWithPlayers: input.locationData.sharedWithPlayers,
            }
          : undefined,
      } as Parameters<typeof updateCampaignAsset>[0];

    case "NPC":
      return {
        ...baseInput,
        npcData: input.npcData
          ? {
              imageUrl: input.npcData.imageUrl,
              physicalDescription: input.npcData.physicalDescription,
              motivation: input.npcData.motivation,
              mannerisms: input.npcData.mannerisms,
              dmNotes: input.npcData.dmNotes,
              sharedWithPlayers: input.npcData.sharedWithPlayers,
            }
          : undefined,
      } as Parameters<typeof updateCampaignAsset>[0];

    case "Plot":
      return {
        ...baseInput,
        plotData: input.plotData
          ? {
              dmNotes: input.plotData.dmNotes,
              sharedWithPlayers: input.plotData.sharedWithPlayers,
              status: input.plotData.status,
              urgency: input.plotData.urgency,
            }
          : undefined,
      } as Parameters<typeof updateCampaignAsset>[0];

    default:
      throw new Error(`Unsupported recordType: ${input.recordType}`);
  }
}

/**
 * Output Translators: Database Types → GraphQL Types
 */

/**
 * Translates LocationData from Prisma to GraphQL LocationData type
 */
function translateLocationData(
  locationData: NonNullable<CampaignAsset["locationData"]>
): CampaignAssetModule.LocationData & { __typename: "LocationData" } {
  return {
    __typename: "LocationData",
    imageUrl: locationData.imageUrl ?? null,
    description: locationData.description,
    condition: locationData.condition,
    pointsOfInterest: locationData.pointsOfInterest,
    characters: locationData.characters,
    dmNotes: locationData.dmNotes,
    sharedWithPlayers: locationData.sharedWithPlayers,
  };
}

/**
 * Translates NPCData from Prisma to GraphQL NPCData type
 */
function translateNPCData(
  npcData: NonNullable<CampaignAsset["npcData"]>
): CampaignAssetModule.NPCData & { __typename: "NPCData" } {
  return {
    __typename: "NPCData",
    imageUrl: npcData.imageUrl ?? null,
    physicalDescription: npcData.physicalDescription,
    motivation: npcData.motivation,
    mannerisms: npcData.mannerisms,
    dmNotes: npcData.dmNotes,
    sharedWithPlayers: npcData.sharedWithPlayers,
  };
}

/**
 * Translates PlotData from Prisma to GraphQL PlotData type
 */
function translatePlotData(
  plotData: NonNullable<CampaignAsset["plotData"]>
): CampaignAssetModule.PlotData & { __typename: "PlotData" } {
  return {
    __typename: "PlotData",
    dmNotes: plotData.dmNotes,
    sharedWithPlayers: plotData.sharedWithPlayers,
    status: plotData.status,
    urgency: plotData.urgency,
    relatedAssets:
      plotData.relatedAssets?.map((rel) => ({
        relatedAssetId: rel.relatedAssetId,
        relationshipSummary: rel.relationshipSummary,
      })) ?? [],
  };
}

/**
 * Translates the polymorphic data field based on recordType
 * This is used by the CampaignAsset.data field resolver
 */
export function translateCampaignAssetData(
  asset: CampaignAsset
): CampaignAssetModule.CampaignAssetData {
  switch (asset.recordType) {
    case "Location":
      if (!asset.locationData) {
        throw new Error(
          `Asset ${asset.id} is marked as Location but has no locationData`
        );
      }
      return translateLocationData(asset.locationData);

    case "NPC":
      if (!asset.npcData) {
        throw new Error(
          `Asset ${asset.id} is marked as NPC but has no npcData`
        );
      }
      return translateNPCData(asset.npcData);

    case "Plot":
      if (!asset.plotData) {
        throw new Error(
          `Asset ${asset.id} is marked as Plot but has no plotData`
        );
      }
      return translatePlotData(asset.plotData);

    default:
      throw new Error(`Unknown recordType: ${asset.recordType}`);
  }
}

/**
 * Translates a CampaignAsset from Prisma to GraphQL CampaignAsset type
 * Returns the asset with a placeholder for the data field, which will be
 * resolved by the CampaignAsset.data field resolver.
 *
 * Note: We cast the asset to unknown then to the required type because GraphQL
 * field resolvers allow parent objects to have different shapes than their declared type.
 * The data field will be properly resolved by translateCampaignAssetData.
 */
export function translateCampaignAsset(
  asset: CampaignAsset
): CampaignAssetModule.CampaignAsset {
  return {
    id: asset.id,
    campaignId: asset.campaignId,
    name: asset.name,
    recordType: asset.recordType,
    summary: asset.summary ?? null,
    playerSummary: asset.playerSummary ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    // Pass through the Prisma asset as parent for the field resolver
    // The field resolver will call translateCampaignAssetData to properly resolve this
    data: asset as unknown as CampaignAssetModule.CampaignAssetData,
  };
}
