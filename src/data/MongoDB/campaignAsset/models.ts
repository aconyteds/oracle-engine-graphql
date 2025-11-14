import { PlotStatus, Urgency } from "@prisma/client";
import { z } from "zod";

export const locationDataSchema = z.object({
  imageUrl: z
    .url()
    .optional()
    .describe("URL of an image representing the location."),
  description: z
    .string()
    .describe(
      "Detailed description of the location, this would be the Read Aloud text that the DM would relay to the players."
    ),
  condition: z
    .string()
    .describe(
      "Current condition of the location, this is meant as a quick reminder summary of the current state of the location."
    ),
  pointsOfInterest: z
    .string()
    .describe(
      "Points of interest within the location, this could include links to Locations, or just be some minor points of interest that the players might discover or ask about."
    ),
  characters: z
    .string()
    .describe(
      "Notable characters present in the location, which will include linked NPCs or smaller characters that the players may interact with."
    ),
  dmNotes: z
    .string()
    .describe(
      "DM notes for the location, this will include secrets, and things that the DM needs to be aware of like traps or loot."
    ),
  sharedWithPlayers: z
    .string()
    .describe(
      "Information shared with players about the location, this shouldn't include any secrets unless the DM has explicitly shared that information."
    ),
});

export const npcDataSchema = z.object({
  imageUrl: z
    .url()
    .optional()
    .describe("URL of an image representing the NPC."),
  physicalDescription: z
    .string()
    .describe(
      "Physical description of the NPC. This would be the read aloud text that the DM would relay to the players about the NPC's appearance."
    ),
  motivation: z
    .string()
    .describe(
      "Motivation of the NPC. This would include their goals, desires, and what drives them."
    ),
  mannerisms: z
    .string()
    .describe(
      "Mannerisms of the NPC. This would include their speech patterns, habits, and any quirks they may have."
    ),
  dmNotes: z
    .string()
    .describe(
      "DM notes for the NPC. This would include secrets, hidden agendas, and any information the DM needs to know about the NPC that the players are not aware of."
    ),
  sharedWithPlayers: z
    .string()
    .describe(
      "Information shared with players about the NPC. This shouldn't include any secrets unless the DM has explicitly shared that information."
    ),
});

export const plotDataSchema = z.object({
  dmNotes: z
    .string()
    .describe(
      "DM notes for the plot point, including any secrets or important information the DM needs to remember."
    ),
  sharedWithPlayers: z
    .string()
    .describe(
      "Information shared with players about the plot point. This shouldn't include any secrets unless the DM has explicitly shared that information."
    ),
  status: z
    .enum(PlotStatus)
    .describe(
      "The current status of the plot point within the campaign. This tracks where the players are in relation to completing the plot point."
    ),
  urgency: z
    .enum(Urgency)
    .describe(
      "The urgency level of the plot point. This identifies how time sensitive a plot might be."
    ),
});
