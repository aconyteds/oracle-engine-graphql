import type { Thread } from "../../../data/MongoDB";
import { updateThread as updateThreadInDB } from "../../../data/MongoDB";

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
  return updateThreadInDB({
    threadId,
    userTitleOverride: title,
    pinned: isPinned,
  });
};
