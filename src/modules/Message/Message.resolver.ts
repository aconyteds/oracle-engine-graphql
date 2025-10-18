import { UnauthorizedError } from "../../graphql/errors";
import { TranslateMessage } from "../utils";
import type { MessageModule } from "./generated";
import { createMessage } from "./service";

const MessageResolvers: MessageModule.Resolvers = {
  Mutation: {
    createMessage: async (
      _,
      { input },
      { user, pubsub, selectedCampaignId }
    ): Promise<MessageModule.CreateMessagePayload> => {
      if (!user) {
        throw UnauthorizedError();
      }
      if (!selectedCampaignId) {
        throw new Error(
          "Campaign selection required. Please provide x-selected-campaign-id header."
        );
      }
      const { message, threadId } = await createMessage(
        input,
        user.id,
        selectedCampaignId
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
};

export default MessageResolvers;
