import type { Thread } from "../../data/MongoDB";
import { DBClient } from "../../data/MongoDB";

export const getCampaignThreads = async (
  campaignId: string
): Promise<Thread[]> => {
  const threads = await DBClient.thread.findMany({
    where: {
      campaignId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!threads) {
    throw new Error(`No threads found for campaign ID ${campaignId}`);
  }
  return threads;
};
