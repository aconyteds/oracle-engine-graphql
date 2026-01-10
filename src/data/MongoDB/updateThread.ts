import type { Thread } from "@prisma/client";
import { DBClient } from "./client";

type UpdateThreadInput = {
  threadId: string;
  userTitleOverride?: string;
  pinned?: boolean;
};

export const updateThread = async ({
  threadId,
  userTitleOverride,
  pinned,
}: UpdateThreadInput): Promise<Thread> => {
  const updateData: {
    userTitleOverride?: string | null;
    pinned?: boolean;
  } = {};

  // Only include fields that are being updated
  if (userTitleOverride !== undefined) {
    updateData.userTitleOverride =
      userTitleOverride === "" ? null : userTitleOverride;
  }

  if (pinned !== undefined) {
    updateData.pinned = pinned;
  }

  const thread = await DBClient.thread.update({
    where: {
      id: threadId,
    },
    data: updateData,
  });

  return thread;
};
