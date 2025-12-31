import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  createCampaignAsset,
  stringifyCampaignAsset,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const createNPCSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(200)
    .describe(
      "Name of the NPC (e.g., 'Elara Moonwhisper', 'Grunk the Blacksmith', 'The Hooded Stranger'). CRITICAL: Maximum 200 characters - keep it concise!"
    ),
  summary: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Brief summary for quick reference and popovers. Written from the Game Master (GM) perspective. CRITICAL: Maximum 200 characters - this must be SHORT! If omitted, will be auto-generated."
    ),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Player-visible summary (no GM secrets). Written from the player perspective. CRITICAL: Maximum 200 characters - keep it concise! If omitted, uses the main summary."
    ),
  imageUrl: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.httpUrl().optional())
    .describe(
      "URL to an image of the NPC. CRITICAL: Must be a valid HTTP/HTTPS URL (e.g., 'https://example.com/portrait.jpg'). Only provide if explicitly set by the user - leave empty otherwise."
    ),
  physicalDescription: z
    .string()
    .describe(
      "Physical appearance read-aloud text. Paint a vivid picture. MUST include: race, age, occupation. Use sensory details (sight, sound, smell). What do players see, hear, or smell when they encounter this character?"
    ),
  motivation: z
    .string()
    .describe(
      "Goals, desires, what drives them. What do they want? What are they afraid of? What are their secrets? Include both short-term wants and long-term ambitions."
    ),
  mannerisms: z
    .string()
    .describe(
      "Speech patterns, habits, quirks. How do they talk? What gestures do they make? Include vocal patterns, catchphrases, nervous tics. Make them instantly recognizable."
    ),
  dmNotes: z
    .string()
    .describe(
      "Game Master (GM) only secrets, hidden agendas, plot connections, tactical notes. This should contain the majority of information. Include combat stats if relevant, connections to factions/NPCs, how they react under pressure."
    ),
  sharedWithPlayers: z
    .string()
    .describe(
      "What players currently know. Update as they discover more. Should NOT include secrets from dmNotes unless revealed. This should be written from the player's perspective."
    ),
});

type CreateNPCInput = z.infer<typeof createNPCSchema>;

export async function createNPC(
  rawInput: CreateNPCInput,
  config: ToolConfig
): Promise<string> {
  const input = createNPCSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    const asset = await createCampaignAsset({
      campaignId: context.campaignId,
      recordType: RecordType.NPC,
      name: input.name,
      summary: input.summary || "",
      playerSummary: input.playerSummary || "",
      sessionEventLink: [],
      npcData: {
        ...(!!input.imageUrl ? { imageUrl: input.imageUrl.toString() } : {}),
        physicalDescription: input.physicalDescription,
        motivation: input.motivation,
        mannerisms: input.mannerisms,
        dmNotes: input.dmNotes,
        sharedWithPlayers: input.sharedWithPlayers,
      },
    });

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<success>NPC created successfully!</success><npc id="${asset.id}" name="${asset.name}">${assetDetails}</npc>`;
  } catch (error) {
    console.error("Error in createNPC tool:", error);
    return "<error>Failed to create NPC. Please try again.</error>";
  }
}

export const createNPCTool = tool(createNPC, {
  name: "create_npc",
  description:
    "Creates new NPC (non-player character) asset. Use for allies, villains, merchants, quest-givers, townspeople, monsters, or any character in the game world. Gather all info from user first.",
  schema: createNPCSchema,
});
