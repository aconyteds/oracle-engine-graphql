import { UnauthorizedError } from "../../graphql/errors";
import { DBClient } from "./client";

export const verifyThreadOwnership = async (
  threadId: string,
  userId: string
): Promise<true> => {
  try {
    await DBClient.thread.findUniqueOrThrow({
      where: {
        id: threadId,
        userId,
      },
    });

    return true;
  } catch {
    throw UnauthorizedError();
  }
};
