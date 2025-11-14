import { CampaignAsset, RecordType } from "@prisma/client";
import { z } from "zod";
import { embedCampaignAsset } from "../../AI";
import { DBClient } from "../client";
import { locationDataSchema, npcDataSchema, plotDataSchema } from "./models";

// Base schema with common fields
const baseAssetSchema = z.object({
  campaignId: z
    .string()
    .describe("The MongoDB ObjectId of the campaign this asset belongs to."),
  name: z
    .string()
    .min(2)
    .max(200)
    .describe(
      "Name of the campaign asset. This might be the name of a location, NPC, or plot point."
    ),
  summary: z
    .string()
    .max(200)
    .default("")
    .describe(
      "A brief summary of the campaign asset. This is used for quick links to populate popover text."
    ),
  playerSummary: z
    .string()
    .max(200)
    .default("")
    .describe(
      "Similar to summary but only visible to players. This should not include any DM secrets."
    ),
  sessionEventLink: z.array(z.string()).default([]),
  relatedAssetList: z.array(z.string()).default([]),
});

// Discriminated union ensures only the correct data field is provided for each type
const createCampaignAssetSchema = z.discriminatedUnion("recordType", [
  baseAssetSchema.extend({
    recordType: z.literal(RecordType.Location),
    locationData: locationDataSchema,
  }),
  baseAssetSchema.extend({
    recordType: z.literal(RecordType.NPC),
    npcData: npcDataSchema,
  }),
  baseAssetSchema.extend({
    recordType: z.literal(RecordType.Plot),
    plotData: plotDataSchema,
  }),
]);

export async function createCampaignAsset(
  input: z.infer<typeof createCampaignAssetSchema>
): Promise<CampaignAsset> {
  const params = createCampaignAssetSchema.parse(input);

  // Build the base data object common to all asset types
  const baseData = {
    campaignId: params.campaignId,
    name: params.name,
    recordType: params.recordType,
    summary: params.summary || null,
    playerSummary: params.playerSummary || null,
    Embeddings: [], // Will be populated after creation
  };

  // Add type-specific data based on recordType
  let assetData;
  switch (params.recordType) {
    case RecordType.Location:
      assetData = {
        ...baseData,
        locationData: params.locationData,
      };
      break;
    case RecordType.NPC:
      assetData = {
        ...baseData,
        npcData: params.npcData,
      };
      break;
    case RecordType.Plot:
      assetData = {
        ...baseData,
        plotData: params.plotData,
      };
      break;
    default:
      // This should never happen due to Zod validation, but TypeScript requires it
      throw new Error(
        `Unsupported record type: ${(params as { recordType: string }).recordType}`
      );
  }

  // Create the campaign asset
  const asset = await DBClient.campaignAsset.create({
    data: assetData,
  });

  if (!asset) {
    console.error("Asset creation returned null or undefined:", assetData);
    throw new Error("Failed to create campaign asset");
  }

  // Generate embeddings after creation
  const embeddings = await embedCampaignAsset(asset);

  if (!embeddings) {
    console.error("Embedding generation returned null or undefined:", asset);
    throw new Error("Failed to generate embeddings");
  }

  // Update the asset with embeddings
  const updatedAsset = await DBClient.campaignAsset.update({
    where: { id: asset.id },
    data: { Embeddings: embeddings },
  });
  if (!updatedAsset) {
    console.error("Asset failed to be updated with embeddings:", {
      where: { id: asset.id },
    });
    throw new Error("Failed to update campaign asset with embeddings");
  }

  return updatedAsset;
}
