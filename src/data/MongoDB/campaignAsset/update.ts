import { CampaignAsset, Prisma, RecordType } from "@prisma/client";
import { z } from "zod";
import { embedCampaignAsset } from "../../AI";
import { DBClient } from "../client";
import { locationDataSchema, npcDataSchema, plotDataSchema } from "./models";

// Base schema with common optional fields for updates
const baseUpdateSchema = z.object({
  assetId: z
    .string()
    .describe("The MongoDB ObjectId of the campaign asset to update."),
  name: z
    .string()
    .min(2)
    .max(200)
    .optional()
    .describe("Updated name of the campaign asset."),
  summary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated brief summary of the campaign asset."),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated player-friendly summary."),
  sessionEventLink: z.array(z.string()).optional(),
  relatedAssetList: z.array(z.string()).optional(),
});

// Discriminated union for type-specific updates
const updateCampaignAssetSchema = z.discriminatedUnion("recordType", [
  baseUpdateSchema.extend({
    recordType: z.literal(RecordType.Location),
    locationData: locationDataSchema.partial().optional(),
  }),
  baseUpdateSchema.extend({
    recordType: z.literal(RecordType.NPC),
    npcData: npcDataSchema.partial().optional(),
  }),
  baseUpdateSchema.extend({
    recordType: z.literal(RecordType.Plot),
    plotData: plotDataSchema.partial().optional(),
  }),
]);

export async function updateCampaignAsset(
  input: z.infer<typeof updateCampaignAssetSchema>
): Promise<CampaignAsset> {
  const params = updateCampaignAssetSchema.parse(input);

  // First, fetch the existing asset to verify it matches the recordType
  const existingAsset = await DBClient.campaignAsset.findUnique({
    where: { id: params.assetId },
  });

  if (!existingAsset) {
    throw new Error(`Campaign asset with id ${params.assetId} not found`);
  }

  if (existingAsset.recordType !== params.recordType) {
    throw new Error(
      `Asset type mismatch: expected ${params.recordType}, got ${existingAsset.recordType}`
    );
  }

  // Build the update data object
  const updateData: Prisma.CampaignAssetUpdateInput = {};

  // Add common fields if provided
  if (params.name !== undefined) updateData.name = params.name;
  if (params.summary !== undefined) updateData.summary = params.summary;
  if (params.playerSummary !== undefined)
    updateData.playerSummary = params.playerSummary;

  // Add type-specific data based on recordType
  // Note: Prisma composite types must be replaced entirely, not partially updated
  switch (params.recordType) {
    case RecordType.Location:
      if (params.locationData && existingAsset.locationData) {
        // Manually merge all fields for composite type
        updateData.locationData = {
          imageUrl:
            params.locationData.imageUrl ?? existingAsset.locationData.imageUrl,
          description:
            params.locationData.description ??
            existingAsset.locationData.description,
          condition:
            params.locationData.condition ??
            existingAsset.locationData.condition,
          pointsOfInterest:
            params.locationData.pointsOfInterest ??
            existingAsset.locationData.pointsOfInterest,
          characters:
            params.locationData.characters ??
            existingAsset.locationData.characters,
          dmNotes:
            params.locationData.dmNotes ?? existingAsset.locationData.dmNotes,
          sharedWithPlayers:
            params.locationData.sharedWithPlayers ??
            existingAsset.locationData.sharedWithPlayers,
        };
      }
      break;
    case RecordType.NPC:
      if (params.npcData && existingAsset.npcData) {
        // Manually merge all fields for composite type
        updateData.npcData = {
          imageUrl: params.npcData.imageUrl ?? existingAsset.npcData.imageUrl,
          physicalDescription:
            params.npcData.physicalDescription ??
            existingAsset.npcData.physicalDescription,
          motivation:
            params.npcData.motivation ?? existingAsset.npcData.motivation,
          mannerisms:
            params.npcData.mannerisms ?? existingAsset.npcData.mannerisms,
          dmNotes: params.npcData.dmNotes ?? existingAsset.npcData.dmNotes,
          sharedWithPlayers:
            params.npcData.sharedWithPlayers ??
            existingAsset.npcData.sharedWithPlayers,
        };
      }
      break;
    case RecordType.Plot:
      if (params.plotData && existingAsset.plotData) {
        // Manually merge all fields for composite type
        updateData.plotData = {
          dmNotes: params.plotData.dmNotes ?? existingAsset.plotData.dmNotes,
          sharedWithPlayers:
            params.plotData.sharedWithPlayers ??
            existingAsset.plotData.sharedWithPlayers,
          status: params.plotData.status ?? existingAsset.plotData.status,
          urgency: params.plotData.urgency ?? existingAsset.plotData.urgency,
        };
      }
      break;
    default:
      throw new Error(
        `Unsupported record type: ${(params as { recordType: string }).recordType}`
      );
  }

  // Update the campaign asset
  const updatedAsset = await DBClient.campaignAsset.update({
    where: { id: params.assetId },
    data: updateData,
  });

  if (!updatedAsset) {
    console.error("Asset update returned null or undefined:", {
      assetId: params.assetId,
      updateData,
    });
    throw new Error("Failed to update campaign asset");
  }

  // Regenerate embeddings if content changed
  const contentChanged =
    params.name !== undefined ||
    params.summary !== undefined ||
    ("locationData" in params && params.locationData !== undefined) ||
    ("npcData" in params && params.npcData !== undefined) ||
    ("plotData" in params && params.plotData !== undefined);

  if (contentChanged) {
    const embeddings = await embedCampaignAsset(updatedAsset);

    if (!embeddings) {
      console.error("Embedding generation returned null or undefined:", {
        assetId: updatedAsset.id,
      });
      throw new Error("Failed to generate embeddings");
    }

    // Update with new embeddings
    const finalAsset = await DBClient.campaignAsset.update({
      where: { id: updatedAsset.id },
      data: { Embeddings: embeddings },
    });

    if (!finalAsset) {
      console.error("Asset failed to be updated with embeddings:", {
        assetId: updatedAsset.id,
      });
      throw new Error("Failed to update campaign asset with embeddings");
    }

    return finalAsset;
  }

  return updatedAsset;
}
