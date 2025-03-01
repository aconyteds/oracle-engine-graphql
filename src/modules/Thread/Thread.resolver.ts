import { verifyThreadOwnership } from "../../data/MongoDB";
import { TranslateMessage, TranslateThread } from "../utils";
import type { ThreadModule } from "./generated";
import { ThreadService } from "./Thread.service";

const ThreadResolvers: ThreadModule.Resolvers = {
  Query: {
    threads: async (_, __, { db, user }): Promise<ThreadModule.Thread[]> => {
      const threadService = new ThreadService(db);
      const threads = await threadService.getUserThreads(user.id);
      return threads.map(TranslateThread);
    },
    getThread: async (
      _,
      { input: { threadId } },
      { db, user }
    ): Promise<ThreadModule.GetThreadPayload | null> => {
      await verifyThreadOwnership(db, threadId, user.id);
      const threadService = new ThreadService(db);
      const thread = await threadService.getThread(threadId);
      return {
        thread: thread ? TranslateThread(thread) : null,
      };
    },
  },
  Thread: {
    messages: async (
      parent,
      _,
      { db, user }
    ): Promise<ThreadModule.Message[]> => {
      const threadId = parent.id;
      await verifyThreadOwnership(db, threadId, user.id);
      const threadService = new ThreadService(db);
      const messages = await threadService.getThreadMessages(threadId);
      return messages.map(TranslateMessage);
    },
  },
};

export default ThreadResolvers;
