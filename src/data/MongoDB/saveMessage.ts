import { calculateTokenCount } from "../AI";
import type { Message, MessageWorkspace } from "./client";
import { DBClient } from "./client";

export type MessageRoles = "user" | "system" | "assistant";

type SaveMessageInput = {
  // The ThreadID that the message was added to
  threadId: string;
  // The message being used to create the thread
  content: string;
  // The Role of the message
  role: MessageRoles;
  // Optional workspace entries for this message, this represents the action that the LLM took when generating the response
  workspace?: MessageWorkspace[];
  // Optional runId for LangSmith tracing
  runId?: string;
};

export const saveMessage = async ({
  threadId,
  content,
  role,
  workspace = [],
  runId,
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
      workspace,
      runId: runId ? String(runId) : null,
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

export const addMessageWorkspaceEntry = async (
  messageId: string,
  workspaceEntry: MessageWorkspace
): Promise<Message> => {
  // Get the current message to append to its workspace
  const currentMessage = await DBClient.message.findUniqueOrThrow({
    where: { id: messageId },
  });

  // Update the message with the new workspace entry
  const updatedMessage = await DBClient.message.update({
    where: { id: messageId },
    data: {
      workspace: [...currentMessage.workspace, workspaceEntry],
    },
  });

  return updatedMessage;
};
