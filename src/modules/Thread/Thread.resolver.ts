import { verifyThreadOwnership } from "../../data/MongoDB";
import { InvalidUserCredentials } from "../../graphql/errors";
import { TranslateMessage, TranslateThread } from "../utils";
import type { ThreadModule } from "./generated";
import { getThread, getThreadMessages, getUserThreads } from "./service";

const ThreadResolvers: ThreadModule.Resolvers = {
  Query: {
    threads: async (_, __, { user }): Promise<ThreadModule.Thread[]> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      const threads = await getUserThreads(user.id);
      return threads.map(TranslateThread);
    },
    getThread: async (
      _,
      { input: { threadId } },
      { user }
    ): Promise<ThreadModule.GetThreadPayload | null> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      await verifyThreadOwnership(threadId, user.id);
      const thread = await getThread(threadId);
      return {
        thread: thread ? TranslateThread(thread) : null,
      };
    },
  },
  Thread: {
    messages: async (parent, _, { user }): Promise<ThreadModule.Message[]> => {
      if (!user) {
        throw InvalidUserCredentials();
      }
      const threadId = parent.id;
      await verifyThreadOwnership(threadId, user.id);
      const messages = await getThreadMessages(threadId);
      return messages.map(TranslateMessage);
    },
  },
  User: {
    threads: async (parent): Promise<ThreadModule.Thread[]> => {
      if (!parent) {
        throw InvalidUserCredentials();
      }
      const threads = await getUserThreads(parent.id);
      return threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        lastUsed: thread.updatedAt.toISOString(),
      }));
    },
  },
};

export default ThreadResolvers;
