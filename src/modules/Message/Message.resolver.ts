import { verifyThreadOwnership } from "../../data/MongoDB";
import { UnauthorizedError } from "../../graphql/errors";
import type { MessageCreatedPayload } from "../../graphql/topics";
import type { Context } from "../../serverContext";
import { TranslateMessage } from "../utils";
import type { MessageModule } from "./generated";
import { MessageService } from "./Message.service";

const MessageResolvers: MessageModule.Resolvers = {
  Mutation: {
    createMessage: async (
      _,
      { input },
      { db, user, pubsub }: Context
    ): Promise<MessageModule.CreateMessagePayload> => {
      if (!user) {
        throw UnauthorizedError();
      }

      const messageService = new MessageService(db);
      const { message, threadId } = await messageService.createMessage(
        input,
        user.id
      );

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
  Subscription: {
    messageCreated: {
      // @ts-ignore
      subscribe: async (_, { input }, { db, user, pubsub }: Context) => {
        if (!user) {
          throw UnauthorizedError();
        }
        const { threadId } = input;
        await verifyThreadOwnership(db, threadId, user.id);

        const asyncIterator = pubsub.asyncIterator("messageCreated");

        const filteredAsyncIterator = {
          async next() {
            while (true) {
              const result = await asyncIterator.next();
              if (result.done) {
                return result;
              }
              // Apply your filter here
              if (result.value.threadId === threadId) {
                return result;
              }
            }
          },
          return() {
            return asyncIterator.return?.();
          },
          throw(error: any) {
            return asyncIterator.throw?.(error);
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        };

        return filteredAsyncIterator;
      },
      resolve: (payload: MessageCreatedPayload) => {
        // Return the message to the client
        return { message: payload.message };
      },
    },
  },
};

export default MessageResolvers;
