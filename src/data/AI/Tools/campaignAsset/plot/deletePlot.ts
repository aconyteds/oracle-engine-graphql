import { tool } from "@langchain/core/tools";
import { RecordType } from "@prisma/client";
import { z } from "zod";
import {
  deleteCampaignAsset,
  getCampaignAssetById,
  verifyCampaignAssetOwnership,
} from "../../../../MongoDB";
import { MessageFactory } from "../../../messageFactory";
import type { RequestContext, ToolConfig } from "../../../types";

const deletePlotSchema = z.object({
  plotId: z
    .string()
    .describe(
      "ID of the plot to delete (from previous search or creation results)"
    ),
});

type DeletePlotInput = z.infer<typeof deletePlotSchema>;

export async function deletePlot(
  rawInput: DeletePlotInput,
  config: ToolConfig
): Promise<string> {
  const input = deletePlotSchema.parse(rawInput);
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
      MessageFactory.progress(`Deleting plot "${existingAsset.name}"...`)
    );

    // HITL middleware will intercept if allowEdits: false
    const result = await deleteCampaignAsset({
      assetId: input.plotId,
    });

    if (result.success) {
      yieldMessage(MessageFactory.assetDeleted("Plot", existingAsset.name));

      return `<success>Plot "${existingAsset.name}" (ID: ${input.plotId}) permanently deleted.</success>`;
    }
    return "<error>Failed to delete plot.</error>";
  } catch (error) {
    console.error("Error in deletePlot tool:", error);

    yieldMessage(MessageFactory.error("Failed to delete plot"));

    if (error instanceof Error && error.message.includes("not authorized")) {
      return "<error>You are not authorized to delete this plot.</error>";
    }
    return "<error>Failed to delete plot.</error>";
  }
}

export const deletePlotTool = tool(deletePlot, {
  name: "delete_plot",
  description:
    "PERMANENTLY deletes a plot asset and removes all references. This action CANNOT BE UNDONE. Always confirm with user before deletion. May require approval based on user settings.",
  schema: deletePlotSchema,
});
