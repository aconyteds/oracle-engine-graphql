import { ApolloServerErrorCode } from "@apollo/server/errors";
import type { Thread } from "../../../data/MongoDB";
import { updateThread as updateThreadInDB } from "../../../data/MongoDB";
import { ServerError } from "../../../graphql/errors";

type UpdateThreadInput = {
  threadId: string;
  title?: string;
  isPinned?: boolean;
};

export const updateThread = async ({
  threadId,
  title,
  isPinned,
}: UpdateThreadInput): Promise<Thread> => {
  try {
    return await updateThreadInDB({
      threadId,
      userTitleOverride: title,
      pinned: isPinned,
    });
  } catch (error) {
    console.error("Error updating thread:", error);
    throw ServerError(
      "Failed to update thread",
      ApolloServerErrorCode.INTERNAL_SERVER_ERROR
    );
  }
};
