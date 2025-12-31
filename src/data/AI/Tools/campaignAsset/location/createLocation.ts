import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  createCampaignAsset,
  stringifyCampaignAsset,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const createLocationSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(200)
    .describe(
      "Name of the location (e.g., 'The Rusty Dragon Inn', 'Cragmaw Castle'). CRITICAL: Maximum 200 characters - keep it concise!"
    ),
  summary: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Brief summary for quick reference and popovers. Written from the Game Master (GM) perspective. CRITICAL: Maximum 200 characters - this must be SHORT! If omitted, will be auto-generated from description."
    ),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Player-visible summary (no GM secrets). Written from the player perspective. CRITICAL: Maximum 200 characters - keep it concise! If omitted, uses the main summary."
    ),
  // TODO:: Update this description when image creation is supported
  imageUrl: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.httpUrl().optional())
    .describe(
      "URL to an image of the location. CRITICAL: Must be a valid HTTP/HTTPS URL (e.g., 'https://example.com/image.jpg'). Only provide if explicitly set by the user - leave empty otherwise."
    ),
  description: z
    .string()
    .describe(
      "Detailed read-aloud description for players. Paint a vivid picture of what they see, hear, and smell. This should only include information meant to describe the location to players."
    ),
  condition: z
    .string()
    .describe(
      "Current state summary (e.g., 'Pristine', 'Damaged from fire', 'Under siege'). Keep brief."
    ),
  pointsOfInterest: z
    .string()
    .describe(
      "Notable features or sub-locations. Can include links to other location assets or mention minor features."
    ),
  characters: z
    .string()
    .describe(
      "NPCs present here. Include linked NPC assets or mention minor characters."
    ),
  dmNotes: z
    .string()
    .describe(
      "Game Master (GM) only information: secrets, traps, treasure, hidden passages, plot hooks. This should be easily readable, and contain the majority of information."
    ),
  sharedWithPlayers: z
    .string()
    .describe(
      "What players currently know. Update as they discover more. Should NOT include secrets from dmNotes unless revealed. This should be written from the player's perspective."
    ),
});

type CreateLocationInput = z.infer<typeof createLocationSchema>;

export async function createLocation(
  rawInput: CreateLocationInput,
  config: ToolConfig
): Promise<string> {
  const input = createLocationSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    const asset = await createCampaignAsset({
      campaignId: context.campaignId,
      recordType: RecordType.Location,
      name: input.name,
      summary: input.summary || "",
      playerSummary: input.playerSummary || "",
      sessionEventLink: [],
      locationData: {
        ...(!!input.imageUrl ? { imageUrl: input.imageUrl.toString() } : {}),
        description: input.description,
        condition: input.condition,
        pointsOfInterest: input.pointsOfInterest,
        characters: input.characters,
        dmNotes: input.dmNotes,
        sharedWithPlayers: input.sharedWithPlayers,
      },
    });

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<success>Location created successfully!</success><location id="${asset.id}" name="${asset.name}">${assetDetails}</location>`;
  } catch (error) {
    console.error("Error in createLocation tool:", error);
    return "<error>Failed to create location. Please try again.</error>";
  }
}

export const createLocationTool = tool(createLocation, {
  name: "create_location",
  description:
    "Creates new location asset. Use for towns, dungeons, landmarks, buildings, rooms, or any physical place. Gather all info from user first.",
  schema: createLocationSchema,
});
