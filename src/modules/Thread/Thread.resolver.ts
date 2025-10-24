import { verifyThreadOwnership } from "../../data/MongoDB";
import { InvalidInput, InvalidUserCredentials } from "../../graphql/errors";
import { TranslateMessage, TranslateThread } from "../utils";
import type { ThreadModule } from "./generated";
import { getCampaignThreads, getThread, getThreadMessages } from "./service";

const ThreadResolvers: ThreadModule.Resolvers = {
  Query: {
    threads: async (
      _,
      __,
      { user, selectedCampaignId }
    ): Promise<ThreadModule.Thread[]> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      if (!selectedCampaignId) {
        throw InvalidInput(
          "Campaign selection required. Please provide x-selected-campaign-id header."
        );
      }
      const threads = await getCampaignThreads(selectedCampaignId);
      return threads.map(TranslateThread);
    },
    getThread: async (
      _,
      { input: { threadId } },
      { user, selectedCampaignId }
    ): Promise<ThreadModule.GetThreadPayload | null> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      if (!selectedCampaignId) {
        throw InvalidInput(
          "Campaign selection required. Please provide x-selected-campaign-id header."
        );
      }
      await verifyThreadOwnership(threadId, user.id, selectedCampaignId);
      const thread = await getThread(threadId);
      return {
        thread: thread ? TranslateThread(thread) : null,
      };
    },
  },
  Thread: {
    messages: async (
      parent,
      _,
      { user, selectedCampaignId }
    ): Promise<ThreadModule.Message[]> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      const threadId = parent.id;
      await verifyThreadOwnership(threadId, user.id, selectedCampaignId);
      const messages = await getThreadMessages(threadId);
      return messages.map(TranslateMessage);
    },
  },
  User: {
    threads: async (
      parent,
      _,
      { selectedCampaignId }
    ): Promise<ThreadModule.Thread[]> => {
      if (!parent) {
        throw InvalidUserCredentials();
      }
      if (!selectedCampaignId) {
        throw new Error(
          "Campaign selection required. Please provide x-selected-campaign-id header."
        );
      }
      const threads = await getCampaignThreads(selectedCampaignId);
      return threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        campaignId: thread.campaignId,
        createdAt: thread.createdAt.toISOString(),
        lastUsed: thread.updatedAt.toISOString(),
      }));
    },
  },
  Campaign: {
    threads: async (parent, _, { loaders }): Promise<ThreadModule.Thread[]> => {
      // Use DataLoader to batch thread queries by campaign ID
      const threads = await loaders.threadsByCampaignId.load(parent.id);
      return threads.map(TranslateThread);
    },
  },
};

export default ThreadResolvers;
