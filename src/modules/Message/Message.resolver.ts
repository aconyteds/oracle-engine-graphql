import { InvalidInput, UnauthorizedError } from "../../graphql/errors";
import { TranslateMessage } from "../utils";
import type { MessageModule } from "./generated";
import { captureHumanFeedback, createMessage } from "./service";

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
    captureHumanFeedback: async (
      _,
      { input },
      { user, selectedCampaignId }
    ): Promise<MessageModule.CaptureHumanFeedbackPayload> => {
      if (!user) {
        throw UnauthorizedError();
      }
      if (!selectedCampaignId) {
        throw InvalidInput(
          "Campaign selection required. Please provide x-selected-campaign-id header."
        );
      }
      const message = await captureHumanFeedback({
        messageId: input.messageId,
        humanSentiment: input.humanSentiment,
        userId: user.id,
        campaignId: selectedCampaignId,
        comments: input.comments || undefined,
      });

      return {
        message,
      };
    },
  },
};

export default MessageResolvers;
