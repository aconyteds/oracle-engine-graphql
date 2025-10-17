import { DBClient } from "../../../data/MongoDB";
import { InvalidInput } from "../../../graphql/errors";

export interface DeleteCampaignParams {
  campaignId: string;
  ownerId: string;
}

export const deleteCampaign = async (
  params: DeleteCampaignParams
): Promise<{ success: boolean; campaignId: string }> => {
  const { campaignId, ownerId } = params;

  // Verify the campaign exists and belongs to the user
  const campaign = await DBClient.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw InvalidInput("Campaign not found");
  }

  if (campaign.ownerId !== ownerId) {
    throw InvalidInput("You do not have permission to delete this campaign");
  }

  // Check if this campaign is the user's lastCampaignId
  const user = await DBClient.user.findUnique({
    where: { id: ownerId },
  });

  // Use a transaction to ensure atomicity
  await DBClient.$transaction(async (tx) => {
    // Clear lastCampaignId if it matches the campaign being deleted
    if (user?.lastCampaignId === campaignId) {
      await tx.user.update({
        where: { id: ownerId },
        data: { lastCampaignId: null },
      });
    }

    // Get all threads associated with this campaign to delete their messages
    const threads = await tx.thread.findMany({
      where: { campaignId: campaignId },
      select: { id: true },
    });

    const threadIds = threads.map((thread) => thread.id);

    // Delete all messages in threads associated with this campaign
    if (threadIds.length > 0) {
      await tx.message.deleteMany({
        where: { threadId: { in: threadIds } },
      });
    }

    // Delete all threads associated with this campaign
    await tx.thread.deleteMany({
      where: { campaignId: campaignId },
    });

    // Delete all session events associated with this campaign
    await tx.sessionEvent.deleteMany({
      where: { campaignId },
    });

    // Delete all campaign assets associated with this campaign
    await tx.campaignAsset.deleteMany({
      where: { campaignId },
    });

    // Delete the campaign
    await tx.campaign.delete({
      where: { id: campaignId },
    });
  });

  return {
    success: true,
    campaignId,
  };
};
