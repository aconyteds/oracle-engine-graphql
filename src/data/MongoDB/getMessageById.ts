import type { Message } from "./client";
import { DBClient } from "./client";

export const getMessageById = async (messageId: string): Promise<Message> => {
  return await DBClient.message.findUniqueOrThrow({
    where: {
      id: messageId,
    },
  });
};
