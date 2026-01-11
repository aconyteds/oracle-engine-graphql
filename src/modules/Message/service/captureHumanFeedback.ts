import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";
import type { Message } from "../../../data/MongoDB";
import {
  getMessageById,
  updateMessageFeedback,
  verifyThreadOwnership,
} from "../../../data/MongoDB";
import { InvalidInput, ServerError } from "../../../graphql/errors";

type CaptureHumanFeedbackInput = {
  messageId: string;
  humanSentiment: boolean;
  userId: string;
  campaignId: string;
};

export const captureHumanFeedback = async ({
  messageId,
  humanSentiment,
  userId,
  campaignId,
}: CaptureHumanFeedbackInput): Promise<string> => {
  try {
    // Get the message to verify it exists and get its thread
    const message: Message = await getMessageById(messageId);

    // Verify the user owns the thread that the message belongs to
    await verifyThreadOwnership(message.threadId, userId, campaignId);

    // Check if feedback has already been provided
    if (
      message.humanSentiment !== null &&
      message.humanSentiment !== undefined
    ) {
      throw InvalidInput(
        "You have already submitted feedback for this message."
      );
    }

    // Update the message with the feedback
    await updateMessageFeedback({ messageId, humanSentiment });

    return "Thank you for providing feedback!";
  } catch (error) {
    // Re-throw GraphQL errors (InvalidInput, UnauthorizedError, etc.)
    if (error instanceof GraphQLError) {
      throw error;
    }

    // Log and throw server error for unexpected errors
    console.error("Error capturing human feedback:", error);
    throw ServerError(
      "Failed to capture feedback",
      ApolloServerErrorCode.INTERNAL_SERVER_ERROR
    );
  }
};
