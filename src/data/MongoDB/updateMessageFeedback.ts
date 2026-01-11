import type { Message } from "./client";
import { DBClient } from "./client";

type UpdateMessageFeedbackInput = {
  messageId: string;
  humanSentiment: boolean;
  comments?: string;
};

export const updateMessageFeedback = async ({
  messageId,
  humanSentiment,
  comments,
}: UpdateMessageFeedbackInput): Promise<Message> => {
  return await DBClient.message.update({
    where: {
      id: messageId,
    },
    data: {
      humanSentiment,
      ...(comments && { feedbackComments: comments }),
    },
  });
};
