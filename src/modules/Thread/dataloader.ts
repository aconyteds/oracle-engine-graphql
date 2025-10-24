import DataLoader from "dataloader";
import type { Thread } from "../../data/MongoDB";
import { DBClient } from "../../data/MongoDB";

/**
 * Creates a DataLoader for batching thread queries by campaign ID.
 * This prevents N+1 queries when resolving Campaign.threads fields.
 *
 * @returns A DataLoader instance that batches getCampaignThreads requests
 */
export const createThreadsByCampaignIdLoader = (): DataLoader<
  string,
  Thread[]
> => {
  return new DataLoader<string, Thread[]>(
    async (campaignIds: readonly string[]): Promise<Thread[][]> => {
      // Fetch all threads for all requested campaign IDs in a single query
      const threads = await DBClient.thread.findMany({
        where: {
          campaignId: {
            in: [...campaignIds],
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      // Group threads by campaignId
      const threadsByCampaignId = new Map<string, Thread[]>();

      // Initialize empty arrays for all requested campaign IDs
      for (const campaignId of campaignIds) {
        threadsByCampaignId.set(campaignId, []);
      }

      // Group threads by their campaign ID
      for (const thread of threads) {
        const campaignThreads = threadsByCampaignId.get(thread.campaignId);
        if (campaignThreads) {
          campaignThreads.push(thread);
        }
      }

      // Return results in the same order as the input keys
      return campaignIds.map(
        (campaignId) => threadsByCampaignId.get(campaignId) || []
      );
    },
    {
      // Cache results per request
      cache: true,
      // Batch multiple requests in the same tick
      batch: true,
      // Give this loader a name for debugging
      name: "ThreadsByCampaignIdLoader",
    }
  );
};
