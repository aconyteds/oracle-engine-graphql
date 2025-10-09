import { verifyThreadOwnership } from "../../data/MongoDB";
import { InactiveAccountError, UnauthorizedError } from "../../graphql/errors";
import type { AiModule } from "./generated";
import { generateMessage } from "./service";

const AIResolvers: AiModule.Resolvers = {
  Subscription: {
    generateMessage: {
      subscribe: async function* (_, { input }, { pubsub, user }) {
        const { threadId } = input;
        if (!user) {
          throw UnauthorizedError();
        }
        if (!user.active) {
          // An account must be tagged as active in the DB to use any LLM features
          throw InactiveAccountError();
        }
        await verifyThreadOwnership(input.threadId, user.id);

        // Use for-await to iterate over the generator and yield each chunk
        for await (const chunk of generateMessage(threadId)) {
          if (!chunk) {
            continue;
          }
          if (chunk.responseType === "Final" && !!chunk.message) {
            // Publish the final message to the PubSub
            await pubsub.publish("messageCreated", {
              threadId,
              message: chunk.message,
            });
          }
          yield chunk;
        }
      },
      resolve: (payload: AiModule.GenerateMessagePayload) => {
        // We just want to return the payload as-is
        return payload;
      },
    },
  },
};

export default AIResolvers;
