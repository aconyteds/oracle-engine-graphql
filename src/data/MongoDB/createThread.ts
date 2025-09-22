import { createTitle } from "../AI";
import { DBClient } from "./client";

type CreateThreadInput = {
  // The message being used to create the thread
  message: string;
  // The user ID from the DB to tie the thread to
  userId: string;
};

export const createThread = async ({
  message,
  userId,
}: CreateThreadInput): Promise<string> => {
  // Create a title using the AI
  const title = await createTitle(message);

  // Create a new thread in the DB
  const thread = await DBClient.thread.create({
    data: {
      title,
      userId,
      // TODO:: Make this more dynamic
      selectedAgent: "Default Router",
      // selectedAgent: "Cheapest",
    },
  });

  // Return the new thread ID
  return thread.id;
};
