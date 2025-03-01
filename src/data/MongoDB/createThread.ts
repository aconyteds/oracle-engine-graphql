import type { PrismaClient } from "@prisma/client";

import { createTitle } from "../AI";

type CreateThreadInput = {
  // The DB Client
  client: PrismaClient;
  // The message being used to create the thread
  message: string;
  // The user ID from the DB to tie the thread to
  userId: string;
};

export const createThread = async ({
  client,
  message,
  userId,
}: CreateThreadInput): Promise<string> => {
  // Create a title using the AI
  const title = await createTitle(message);

  // Create a new thread in the DB
  const thread = await client.thread.create({
    data: {
      title,
      userId,
      // TODO:: Make this more dynamic
      selectedAgent: "Cheapest",
    },
  });

  // Return the new thread ID
  return thread.id;
};
