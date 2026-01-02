import { tool } from "@langchain/core/tools";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";
import { z } from "zod";
import {
  createCampaignAsset,
  stringifyCampaignAsset,
} from "../../../../MongoDB";
import type { RequestContext, ToolConfig } from "../../../types";

const createPlotSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(200)
    .describe(
      "Name of the plot/quest/story arc (e.g., 'The Missing Merchant Prince', 'Siege of Thornwatch'). CRITICAL: Maximum 200 characters!"
    ),
  gmSummary: z
    .string()
    .max(200)
    .describe(
      "Brief Game Master (GM) summary of the core plot. CRITICAL: Maximum 200 characters! If omitted, will be auto-generated."
    ),
  gmNotes: z
    .string()
    .describe(
      "Detailed Game Master (GM) notes including: Stakes (what happens if players succeed/fail), Key NPCs (mention names for relationship linking!), Locations (mention names!), Secrets, Clues/Evidence, Alternative paths, Contingencies. This should contain the MAJORITY of information."
    ),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Player-visible summary (no secrets/spoilers). CRITICAL: Maximum 200 characters! What players currently know about this plot."
    ),
  playerNotes: z
    .string()
    .optional()
    .describe(
      "What players currently know from their perspective. Should NOT include secrets unless revealed. Updates as players discover more."
    ),
  status: z
    .nativeEnum(PlotStatus)
    .describe(
      "Current plot state: Unknown (no player knowledge), Rumored (players heard hints), InProgress (actively pursuing), WillNotDo (decided not to pursue), Closed (resolved)"
    ),
  urgency: z
    .nativeEnum(Urgency)
    .describe(
      "Time sensitivity: Ongoing (no pressure), TimeSensitive (has deadline), Critical (immediate), Resolved (concluded)"
    ),
});

type CreatePlotInput = z.infer<typeof createPlotSchema>;

export async function createPlot(
  rawInput: CreatePlotInput,
  config: ToolConfig
): Promise<string> {
  const input = createPlotSchema.parse(rawInput);
  const context = config.context as RequestContext;

  try {
    const asset = await createCampaignAsset({
      campaignId: context.campaignId,
      recordType: RecordType.Plot,
      name: input.name,
      gmSummary: input.gmSummary || "",
      gmNotes: input.gmNotes || "",
      playerSummary: input.playerSummary || "",
      playerNotes: input.playerNotes || "",
      sessionEventLink: [],
      plotData: {
        status: input.status,
        urgency: input.urgency,
      },
    });

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<success>Plot created successfully!</success><plot id="${asset.id}" name="${asset.name}">${assetDetails}</plot>`;
  } catch (error) {
    console.error("Error in createPlot tool:", error);
    return "<error>Failed to create plot. Please try again.</error>";
  }
}

export const createPlotTool = tool(createPlot, {
  name: "create_plot",
  description:
    "Creates new plot/story asset. Use for quests, mysteries, story arcs, narrative threads, or any story element. Gather all info from user first before creation.",
  schema: createPlotSchema,
});
