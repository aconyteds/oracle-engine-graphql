import { verifyThreadOwnership } from "../../data/MongoDB";
import { TranslateMessage, TranslateThread } from "../utils";
import type { ThreadModule } from "./generated";
import { getThread, getThreadMessages, getUserThreads } from "./service";

const ThreadResolvers: ThreadModule.Resolvers = {
  Query: {
    threads: async (_, __, { user }): Promise<ThreadModule.Thread[]> => {
      const threads = await getUserThreads(user.id);
      return threads.map(TranslateThread);
    },
    getThread: async (
      _,
      { input: { threadId } },
      { user }
    ): Promise<ThreadModule.GetThreadPayload | null> => {
      await verifyThreadOwnership(threadId, user.id);
      const thread = await getThread(threadId);
      return {
        thread: thread ? TranslateThread(thread) : null,
      };
    },
  },
  Thread: {
    messages: async (parent, _, { user }): Promise<ThreadModule.Message[]> => {
      const threadId = parent.id;
      await verifyThreadOwnership(threadId, user.id);
      const messages = await getThreadMessages(threadId);
      return messages.map(TranslateMessage);
    },
  },
};

export default ThreadResolvers;
