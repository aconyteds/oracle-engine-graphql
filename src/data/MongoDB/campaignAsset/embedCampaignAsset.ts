import { createEmbeddings } from "../../AI";
import { type CampaignAsset, RecordType } from "../client";

/**
 * Extracts relevant text fields based on the asset's recordType and creates a single embedding vector.
 *
 * @param asset - The campaign asset to generate embeddings for (NPC, Location, or Plot)
 * @returns Promise<Float[]> - Array of embedding values, or empty array on error
 */
export const embedCampaignAsset = async (
  asset: CampaignAsset
): Promise<number[]> => {
  try {
    const textToEmbed = stringifyCampaignAsset(asset);

    if (!textToEmbed.trim()) {
      console.error("No text content found for embedding");
      return [];
    }

    const result = await createEmbeddings(textToEmbed);
    return result;
  } catch (error) {
    console.error("Error generating embeddings for campaign asset:", error);
    return [];
  }
};

/**
 * Extracts relevant text fields from a campaign asset based on its type.
 * Combines multiple fields into a single string suitable for embedding generation or passing to an LLM.
 *
 * @param asset - The campaign asset to extract text from
 * @returns string - Concatenated text content
 */
export function stringifyCampaignAsset(
  asset: Pick<
    CampaignAsset,
    "recordType" | "name" | "summary" | "npcData" | "locationData" | "plotData"
  >
): string {
  const parts: string[] = [];

  // Always include name and summary if present
  if (asset.name) parts.push(`Name: ${asset.name}`);
  if (asset.summary) parts.push(`Summary: ${asset.summary}`);

  switch (asset.recordType) {
    case RecordType.NPC:
      if (asset.npcData) {
        if (asset.npcData.physicalDescription) {
          parts.push(
            `Physical Description: ${asset.npcData.physicalDescription}`
          );
        }
        if (asset.npcData.motivation) {
          parts.push(`Motivation: ${asset.npcData.motivation}`);
        }
        if (asset.npcData.mannerisms) {
          parts.push(`Mannerisms: ${asset.npcData.mannerisms}`);
        }
        if (asset.npcData.dmNotes) {
          parts.push(`DM Notes: ${asset.npcData.dmNotes}`);
        }
      }
      break;

    case RecordType.Location:
      if (asset.locationData) {
        if (asset.locationData.description) {
          parts.push(`Description: ${asset.locationData.description}`);
        }
        if (asset.locationData.condition) {
          parts.push(`Condition: ${asset.locationData.condition}`);
        }
        if (asset.locationData.pointsOfInterest) {
          parts.push(
            `Points of Interest: ${asset.locationData.pointsOfInterest}`
          );
        }
        if (asset.locationData.characters) {
          parts.push(`Characters: ${asset.locationData.characters}`);
        }
        if (asset.locationData.dmNotes) {
          parts.push(`DM Notes: ${asset.locationData.dmNotes}`);
        }
      }
      break;

    case RecordType.Plot:
      if (asset.plotData) {
        if (asset.plotData.dmNotes) {
          parts.push(`DM Notes: ${asset.plotData.dmNotes}`);
        }
        if (asset.plotData.sharedWithPlayers) {
          parts.push(
            `Shared With Players: ${asset.plotData.sharedWithPlayers}`
          );
        }
        if (asset.plotData.status) {
          parts.push(`Status: ${asset.plotData.status}`);
        }
        if (asset.plotData.urgency) {
          parts.push(`Urgency: ${asset.plotData.urgency}`);
        }
      }
      break;
  }

  return parts.join("\n");
}
