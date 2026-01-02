import { PlotStatus, Urgency } from "@prisma/client";
import { z } from "zod";

export const locationDataSchema = z.object({
  imageUrl: z
    .union([z.url(), z.literal(""), z.null()])
    .optional()
    .describe("URL of an image representing the location."),
  description: z
    .string()
    .describe(
      "Detailed description of the location, this would be the Read Aloud text that the Game Master (GM) would relay to the players."
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
});

export const npcDataSchema = z.object({
  imageUrl: z
    .union([z.url(), z.literal(""), z.null()])
    .optional()
    .describe("URL of an image representing the NPC."),
  physicalDescription: z
    .string()
    .describe(
      "Physical description of the NPC. This would be the read aloud text that the Game Master (GM) would relay to the players about the NPC's appearance."
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
});

export const plotDataSchema = z.object({
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
