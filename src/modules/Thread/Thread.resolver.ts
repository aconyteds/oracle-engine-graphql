import { verifyThreadOwnership } from "../../data/MongoDB";
import {
  TranslateMessage,
  TranslateThread,
  TranslateThreadOptions,
} from "../utils";
import { ThreadModule } from "./generated";
import { ThreadService } from "./Thread.service";

const ThreadResolvers: ThreadModule.Resolvers = {
  Query: {
    threads: async (_, __, { db, userId }): Promise<ThreadModule.Thread[]> => {
      const threadService = new ThreadService(db);
      const threads = await threadService.getUserThreads(userId);
      return threads.map(TranslateThread);
    },
    getThread: async (
      _,
      { input: { threadId } },
      { db, userId }
    ): Promise<ThreadModule.GetThreadPayload | null> => {
      await verifyThreadOwnership(db, threadId, userId);
      const threadService = new ThreadService(db);
      const thread = await threadService.getThread(threadId);
      return {
        thread: thread ? TranslateThread(thread) : null,
      };
    },
    threadOptions: async (
      _,
      { input: { threadId } },
      { db, userId }
    ): Promise<ThreadModule.ThreadOptionsPayload | null> => {
      await verifyThreadOwnership(db, threadId, userId);
      const threadService = new ThreadService(db);
      const threadOption = await threadService.getThreadOptions(threadId);
      return {
        threadId,
        options: threadOption ? TranslateThreadOptions(threadOption) : null,
      };
    },
  },
  Thread: {
    messages: async (
      parent,
      _,
      { db, userId }
    ): Promise<ThreadModule.Message[]> => {
      const threadId = parent.id;
      await verifyThreadOwnership(db, threadId, userId);
      const threadService = new ThreadService(db);
      const messages = await threadService.getThreadMessages(threadId);
      return messages.map(TranslateMessage);
    },
    threadOption: async (
      parent,
      _,
      { db, userId }
    ): Promise<ThreadModule.ThreadOptions | null> => {
      const threadId = parent.id;
      await verifyThreadOwnership(db, threadId, userId);
      const threadService = new ThreadService(db);
      const threadOption = await threadService.getThreadOptions(threadId);
      return threadOption ? TranslateThreadOptions(threadOption) : null;
    },
  },
};

export default ThreadResolvers;
