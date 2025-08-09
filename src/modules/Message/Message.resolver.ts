import { verifyThreadOwnership } from "../../data/MongoDB";
import { UnauthorizedError } from "../../graphql/errors";
import type { ServerContext } from "../../serverContext";
import { TranslateMessage } from "../utils";
import type { MessageModule } from "./generated";
import { createMessage } from "./service";

const MessageResolvers: MessageModule.Resolvers = {
  Mutation: {
    createMessage: async (
      _,
      { input },
      { user, pubsub }: ServerContext
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
  },
};

export default MessageResolvers;
