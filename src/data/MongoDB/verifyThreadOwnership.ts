import { PrismaClient } from "@prisma/client";

export const verifyThreadOwnership = async (
  client: PrismaClient,
  threadId: string,
  userId: string
): Promise<true> => {
  await client.thread.findUniqueOrThrow({
    where: {
      id: threadId,
      userId,
    },
  });

  return true;
};
