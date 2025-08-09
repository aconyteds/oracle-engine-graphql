import type { Thread } from "./client";
import { DBClient } from "./client";

export const getUserThreads = async (userId: string): Promise<Thread[]> => {
  const user = await DBClient.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      threads: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user.threads;
};
