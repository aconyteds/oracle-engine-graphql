import { DBClient, Thread } from "../../../data/MongoDB";

export const getUserThreads = async (userId: string): Promise<Thread[]> => {
  const threads = await DBClient.thread.findMany({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!threads) {
    throw new Error(`No threads found for user ID ${userId}`);
  }
  return threads;
};
