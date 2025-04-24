import { streamManager } from "../../data/AI";
import { verifyThreadOwnership } from "../../data/MongoDB";
import {
  InactiveAccountError,
  InvalidInput,
  UnauthorizedError,
} from "../../graphql/errors";
import type { Context } from "../../serverContext";
import { TranslateMessage } from "../utils";
import type { MessageModule } from "./generated";
import { createMessage } from "./service";

const MessageResolvers: MessageModule.Resolvers = {
  Mutation: {
    createMessage: async (
      _,
      { input },
      { user, pubsub }: Context
    ): Promise<MessageModule.CreateMessagePayload> => {
      if (!user) {
        throw UnauthorizedError();
      }
      if (input.threadId) {
        // Verify that the user has access to the thread
        await verifyThreadOwnership(input.threadId, user.id);
      }
      const { message, threadId } = await createMessage(input, user.id);

      const translatedMessage = TranslateMessage(message);

      // Publish the message to the 'messageCreated' event
      await pubsub.publish("messageCreated", {
        threadId,
        message: translatedMessage,
      });

      return {
        threadId,
        message: translatedMessage,
      };
    },
    generateThread: async (
      _,
      { input: { threadId } },
      { user }: Context
    ): Promise<MessageModule.GenerateThreadPayload> => {
      if (!user) {
        throw UnauthorizedError();
      }
      if (!user.active) {
        throw InactiveAccountError();
      }
      if (!threadId) {
        throw InvalidInput("Thread ID is required");
      }

      await verifyThreadOwnership(threadId, user.id);
      const streamUrl = `/sse/threads/${threadId}`;
      const existingStream = streamManager.getStream(threadId);

      return {
        alreadyInitiated: !!existingStream,
        threadId,
        url: streamUrl,
      };
    },
  },
};

export default MessageResolvers;
