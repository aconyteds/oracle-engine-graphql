import type { PrismaClient, ThreadOptions } from "@prisma/client";

import { createTitle } from "../AI";

type CreateThreadInput = {
  // The DB Client
  client: PrismaClient;
  // The message being used to create the thread
  message: string;
  // The user ID from the DB to tie the thread to
  userId: string;
};

const DEFAULT_THREAD_OPTIONS: ThreadOptions = {
  model: "gpt-4o",
  systemMessage: "Generate Message using Markdown",
  temperature: 0.7,
  useHistory: true,
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
      threadOptions: DEFAULT_THREAD_OPTIONS,
    },
  });

  // Return the new thread ID
  return thread.id;
};
