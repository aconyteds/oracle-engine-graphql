import { createTitle } from "../AI";
import { DBClient } from "./client";

type CreateThreadInput = {
  // The message being used to create the thread
  message: string;
  // The campaign ID to tie the thread to
  campaignId: string;
  // The user ID creating the thread
  userId: string;
};

export const createThread = async ({
  message,
  campaignId,
  userId,
}: CreateThreadInput): Promise<string> => {
  // Create a title using the AI
  const title = await createTitle(message);

  // Create a new thread in the DB
  const thread = await DBClient.thread.create({
    data: {
      title,
      campaignId,
      userId,
    },
  });

  // Return the new thread ID
  return thread.id;
};
