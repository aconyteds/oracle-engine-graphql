import type { Thread } from "../../../data/MongoDB";
import { getCampaignThreads as getCampaignThreadsFromDB } from "../../../data/MongoDB";

export const getCampaignThreads = async (
  campaignId: string
): Promise<Thread[]> => {
  return getCampaignThreadsFromDB(campaignId);
};
