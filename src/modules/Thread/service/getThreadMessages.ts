import type { Message } from "../../../data/MongoDB";
import { DBClient } from "../../../data/MongoDB";

export const getThreadMessages = async (
  threadId: string
): Promise<Message[]> => {
  const messages = await DBClient.message.findMany({
    where: {
      threadId,
    },
  });

  if (!messages) {
    throw new Error(`No messages found for thread ID ${threadId}`);
  }
  return messages;
};
