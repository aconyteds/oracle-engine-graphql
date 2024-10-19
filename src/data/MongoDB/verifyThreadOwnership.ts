import { PrismaClient } from "@prisma/client";
import { UnauthorizedError } from "../../graphql/errors";

export const verifyThreadOwnership = async (
  client: PrismaClient,
  threadId: string,
  userId: string
): Promise<true> => {
  try {
    await client.thread.findUniqueOrThrow({
      where: {
        id: threadId,
        userId,
      },
    });

    return true;
  } catch (error) {
    throw UnauthorizedError();
  }
};
