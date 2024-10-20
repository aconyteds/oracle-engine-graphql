import { verifyThreadOwnership } from "../../data/MongoDB";
import { UnauthorizedError } from "../../graphql/errors";
import type { Context } from "../../serverContext";
import { AIService } from "./AI.service";
import type { AiModule } from "./generated";

const AIResolvers: AiModule.Resolvers = {
  Subscription: {
    generateMessage: {
      subscribe: async function* (
        _,
        { input },
        { pubsub, db, userId }: Context
      ) {
        const { threadId } = input;
        if (!userId) {
          throw UnauthorizedError();
        }
        await verifyThreadOwnership(db, input.threadId, userId);
        const aiService = new AIService(db);

        // Use for-await to iterate over the generator and yield each chunk
        for await (const chunk of aiService.generateMessage(threadId)) {
          if (!chunk) {
            continue;
          }
          if (chunk.responseType === "Final" && !!chunk.message) {
            // Publish the final message to the PubSub
            pubsub.publish("messageCreated", {
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
