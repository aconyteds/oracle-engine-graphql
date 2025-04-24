import { DBClient, Thread } from "../../../data/MongoDB";

export const getThread = async (threadId: string): Promise<Thread | null> => {
  const thread = await DBClient.thread.findUnique({
    where: {
      id: threadId,
    },
  });
  if (!thread) {
    throw new Error(`Thread with ID ${threadId} not found`);
  }
  return thread;
};
