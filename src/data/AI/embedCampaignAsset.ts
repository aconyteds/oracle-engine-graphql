import { OpenAIEmbeddings } from "@langchain/openai";
import { encoding_for_model } from "tiktoken";

import { type CampaignAsset, RecordType } from "../MongoDB";
import { getModelByName } from "./modelList";

/**
 * Generates vector embeddings for a campaign asset using OpenAI's text-embedding-3-small model.
 * Extracts relevant text fields based on the asset's recordType and creates a single embedding vector.
 *
 * @param asset - The campaign asset to generate embeddings for (NPC, Location, or Plot)
 * @returns Promise<Float[]> - Array of embedding values, or empty array on error
 */
export const embedCampaignAsset = async (
  asset: CampaignAsset
): Promise<number[]> => {
  const currentEmbeddingsModel = "text-embedding-3-small";
  try {
    const embeddingModel = getModelByName(currentEmbeddingsModel);
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: embeddingModel.modelName,
    });

    let textToEmbed = extractTextForEmbedding(asset);

    if (!textToEmbed.trim()) {
      console.error("No text content found for embedding");
      return [];
    }

    const encoder = encoding_for_model(currentEmbeddingsModel);
    try {
      const tokenCount = encoder.encode(textToEmbed).length;
      if (tokenCount > embeddingModel.contextWindow) {
        console.warn(
          `Text exceeds context window of ${embeddingModel.contextWindow} tokens (actual: ${tokenCount}). Truncating text.`
        );
        // Efficient truncation: tokenize once, slice to context window, decode back
        const encoder = encoding_for_model(currentEmbeddingsModel);

        const tokens = encoder.encode(textToEmbed);
        const truncatedTokens = tokens.slice(0, embeddingModel.contextWindow);
        textToEmbed = new TextDecoder().decode(encoder.decode(truncatedTokens));
      }
    } finally {
      encoder.free();
    }
    const result = await embeddings.embedQuery(textToEmbed);
    return result;
  } catch (error) {
    console.error("Error generating embeddings for campaign asset:", error);
    return [];
  }
};

/**
 * Extracts relevant text fields from a campaign asset based on its type.
 * Combines multiple fields into a single string suitable for embedding generation.
 *
 * @param asset - The campaign asset to extract text from
 * @returns string - Concatenated text content
 */
function extractTextForEmbedding(asset: CampaignAsset): string {
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
        if (asset.plotData.summary) {
          parts.push(`Plot Summary: ${asset.plotData.summary}`);
        }
        if (asset.plotData.status) {
          parts.push(`Status: ${asset.plotData.status}`);
        }
        if (asset.plotData.urgency) {
          parts.push(`Urgency: ${asset.plotData.urgency}`);
        }
        if (
          asset.plotData.relatedAssets &&
          asset.plotData.relatedAssets.length > 0
        ) {
          const relationships = asset.plotData.relatedAssets
            .map((rel) => rel.relationshipSummary)
            .join("; ");
          parts.push(`Related Assets: ${relationships}`);
        }
      }
      break;

    case RecordType.SessionEvent:
      // SessionEvent embeddings are not currently supported
      break;
  }

  return parts.join("\n");
}
