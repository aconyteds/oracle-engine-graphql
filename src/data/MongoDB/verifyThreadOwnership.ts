import { UnauthorizedError } from "../../graphql/errors";
import { DBClient } from "./client";

export const verifyThreadOwnership = async (
  threadId: string,
  userId: string,
  campaignId?: string
): Promise<true> => {
  try {
    const thread = await DBClient.thread.findUniqueOrThrow({
      where: {
        id: threadId,
      },
      include: {
        campaign: true,
      },
    });

    // Verify the user owns the campaign
    if (thread.campaign.ownerId !== userId) {
      throw UnauthorizedError();
    }

    // If campaignId is provided, verify thread belongs to that campaign
    if (campaignId && thread.campaignId !== campaignId) {
      throw new Error("Thread does not belong to the selected campaign.");
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("selected campaign")) {
      throw error;
    }
    throw UnauthorizedError();
  }
};
