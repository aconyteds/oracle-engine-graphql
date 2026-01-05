import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  getCampaignAssetById,
  stringifyCampaignAsset,
  updateCampaignAsset,
  verifyCampaignAssetOwnership,
} from "../../../../MongoDB";
import { plotDataSchema } from "../../../../MongoDB/campaignAsset/models";
import { MessageFactory } from "../../../messageFactory";
import type { RequestContext, ToolConfig } from "../../../types";

const updatePlotSchema = z.object({
  plotId: z
    .string()
    .describe(
      "ID of the plot to update (from previous search or creation results)"
    ),
  name: z
    .string()
    .min(2)
    .max(200)
    .optional()
    .describe("Updated name (maximum 200 characters)"),
  gmSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated Game Master (GM) summary (maximum 200 characters)"),
  gmNotes: z.string().optional().describe("Updated GM notes"),
  playerSummary: z
    .string()
    .max(200)
    .optional()
    .describe("Updated player-facing summary (maximum 200 characters)"),
  playerNotes: z.string().optional().describe("Updated player notes"),
  plotData: plotDataSchema
    .partial()
    .optional()
    .describe(
      "Updated plot fields. Only include fields you want to change. Available fields: status, urgency"
    ),
});

type UpdatePlotInput = z.infer<typeof updatePlotSchema>;

export async function updatePlot(
  rawInput: UpdatePlotInput,
  config: ToolConfig
): Promise<string> {
  const input = updatePlotSchema.parse(rawInput);
  const context = config.context as RequestContext;
  const { yieldMessage } = context;

  try {
    await verifyCampaignAssetOwnership(input.plotId, context.userId);

    const existingAsset = await getCampaignAssetById({
      assetId: input.plotId,
      recordType: RecordType.Plot,
    });

    if (!existingAsset) {
      return `<error>Plot with ID "${input.plotId}" not found or is not a Plot.</error>`;
    }

    yieldMessage(
      MessageFactory.progress(`Updating plot "${existingAsset.name}"...`)
    );

    const asset = await updateCampaignAsset({
      assetId: input.plotId,
      recordType: RecordType.Plot,
      name: input.name,
      gmSummary: input.gmSummary,
      gmNotes: input.gmNotes,
      playerSummary: input.playerSummary,
      playerNotes: input.playerNotes,
      plotData: input.plotData,
    });

    yieldMessage(MessageFactory.assetUpdated("Plot", asset.id, asset.name));

    const assetDetails = await stringifyCampaignAsset(asset);
    return `<success>Plot updated successfully!</success><plot id="${asset.id}" name="${asset.name}">${assetDetails}</plot>`;
  } catch (error) {
    console.error("Error in updatePlot tool:", error);

    yieldMessage(MessageFactory.error("Failed to update plot"));

    if (error instanceof Error && error.message.includes("not authorized")) {
      return "<error>You are not authorized to update this plot.</error>";
    }
    if (error instanceof Error && error.message.includes("type mismatch")) {
      return "<error>The specified asset is not a plot.</error>";
    }
    return "<error>Failed to update plot.</error>";
  }
}

export const updatePlotTool = tool(updatePlot, {
  name: "update_plot",
  description:
    "Updates an existing plot asset. Only provide fields you want to change. Use to reflect story progression, new discoveries, status/urgency changes, or relationship updates.",
  schema: updatePlotSchema,
});
