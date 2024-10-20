import { withFilter } from "graphql-subscriptions";

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
      { db, userId, pubsub }: Context
    ): Promise<MessageModule.CreateMessagePayload> => {
      if (!userId) {
        throw UnauthorizedError();
      }

      const messageService = new MessageService(db);
      const { message, threadId } = await messageService.createMessage(
        input,
        userId
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
      subscribe: async (_, { input }, { db, userId, pubsub }: Context) => {
        if (!userId) {
          throw UnauthorizedError();
        }
        const { threadId } = input;
        await verifyThreadOwnership(db, threadId, userId);

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
