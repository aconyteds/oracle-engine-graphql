import { Message, PrismaClient } from "@prisma/client";
import { calculateTokenCount } from "../AI";

export type MessageRoles = "user" | "system" | "assistant" | "tool_calls";

type CreateMessageInput = {
  // The DB Client
  client: PrismaClient;
  // The ThreadID that the message was added to
  threadId: string;
  // The message being used to create the thread
  content: string;
  // The Role of the message
  role: MessageRoles;
};

export const createMessage = async ({
  client,
  threadId,
  content,
  role,
}: CreateMessageInput): Promise<Message> => {
  // Calculate the token Count
  const tokenCount = calculateTokenCount(content);

  // Create a new message in the DB
  const newMessage = await client.message.create({
    data: {
      content,
      threadId,
      role,
      tokenCount,
    },
  });

  await client.thread.update({
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
