import { calculateTokenCount } from "../AI";
import { DBClient, Message } from "./client";

export type MessageRoles = "user" | "system" | "assistant" | "tool_calls";

type SaveMessageInput = {
  // The ThreadID that the message was added to
  threadId: string;
  // The message being used to create the thread
  content: string;
  // The Role of the message
  role: MessageRoles;
};

export const saveMessage = async ({
  threadId,
  content,
  role,
}: SaveMessageInput): Promise<Message> => {
  // Calculate the token Count
  const tokenCount = calculateTokenCount(content);

  // Create a new message in the DB
  const newMessage = await DBClient.message.create({
    data: {
      content,
      threadId,
      role,
      tokenCount,
    },
  });

  await DBClient.thread.update({
    where: {
      id: threadId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  // Return the new message ID
  return newMessage;
};
