import type { Message, MessageWorkspace } from "./client";
import { DBClient } from "./client";

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
