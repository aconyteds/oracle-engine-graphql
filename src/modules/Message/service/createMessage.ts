import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";

import type { Message } from "../../../data/MongoDB";
import type { MessageModule } from "../generated";
import {
  saveMessage,
  createThread,
  verifyThreadOwnership,
} from "../../../data/MongoDB";

type CreateMessageResponse = {
  // The Message that was added to the DB
  message: Message;
  // The ThreadID that the message was added to
  threadId: string;
};

export async function createMessage(
  input: MessageModule.CreateMessageInput,
  userId: string
): Promise<CreateMessageResponse> {
  if (!input || !input.content) {
    throw new GraphQLError("Invalid user credentials", {
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
      },
    });
  }

  let threadId = input.threadId;
  const { content } = input;
  if (!threadId) {
    // Create a new thread in the DB
    threadId = await createThread({
      message: input.content,
      userId,
    });
  } else {
    // Verify that the user has access to the thread
    await verifyThreadOwnership(threadId, userId);
  }

  const message = await saveMessage({
    threadId,
    content,
    role: "user",
  });

  return {
    threadId,
    message,
  };
}
