import type { Message } from "./client";
import { DBClient } from "./client";

type UpdateMessageFeedbackInput = {
  messageId: string;
  humanSentiment: boolean;
};

export const updateMessageFeedback = async ({
  messageId,
  humanSentiment,
}: UpdateMessageFeedbackInput): Promise<Message> => {
  return await DBClient.message.update({
    where: {
      id: messageId,
    },
    data: {
      humanSentiment,
    },
  });
};
