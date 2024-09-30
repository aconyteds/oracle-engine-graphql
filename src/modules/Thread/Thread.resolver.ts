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
      { db }
    ): Promise<ThreadModule.GetThreadPayload | null> => {
      const threadService = new ThreadService(db);
      const thread = await threadService.getThread(threadId);
      return {
        thread: thread ? TranslateThread(thread) : null,
      };
    },
    threadOptions: async (
      _,
      { input: { threadId } },
      { db }
    ): Promise<ThreadModule.ThreadOptionsPayload | null> => {
      const threadService = new ThreadService(db);
      const threadOption = await threadService.getThreadOptions(threadId);
      return {
        threadId,
        options: threadOption ? TranslateThreadOptions(threadOption) : null,
      };
    },
  },
  Thread: {
    messages: async (parent, _, { db }): Promise<ThreadModule.Message[]> => {
      const threadService = new ThreadService(db);
      const messages = await threadService.getThreadMessages(parent.id);
      return messages.map(TranslateMessage);
    },
    threadOption: async (
      parent,
      _,
      { db, userId }
    ): Promise<ThreadModule.ThreadOptions | null> => {
      const threadService = new ThreadService(db);
      const threadOption = await threadService.getThreadOptions(parent.id);
      return threadOption ? TranslateThreadOptions(threadOption) : null;
    },
  },
};

export default ThreadResolvers;
