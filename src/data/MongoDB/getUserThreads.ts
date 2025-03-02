import type { PrismaClient, Thread } from "@prisma/client";

export const getUserThreads = async (
  db: PrismaClient,
  userId: string
): Promise<Thread[]> => {
  const user = await db.user.findUnique({
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
