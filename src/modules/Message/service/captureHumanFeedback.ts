import { ApolloServerErrorCode } from "@apollo/server/errors";
import { GraphQLError } from "graphql";
import { sendLangSmithFeedback } from "../../../data/LangSmith";
import type { Message } from "../../../data/MongoDB";
import {
  DBClient,
  updateMessageFeedback,
  verifyThreadOwnership,
} from "../../../data/MongoDB";
import { InvalidInput, ServerError } from "../../../graphql/errors";

type CaptureHumanFeedbackInput = {
  messageId: string;
  userId: string;
  campaignId: string;
  humanSentiment: boolean;
  comments?: string;
};

export const captureHumanFeedback = async ({
  messageId,
  humanSentiment,
  userId,
  campaignId,
  comments,
}: CaptureHumanFeedbackInput): Promise<string> => {
  try {
    // Get the message to verify it exists and get its thread
    const message: Message = await await DBClient.message.findUniqueOrThrow({
      where: {
        id: messageId,
      },
    });

    // Verify the user owns the thread that the message belongs to
    await verifyThreadOwnership(message.threadId, userId, campaignId);

    // Check if feedback has already been provided
    if (message.humanSentiment === true || message.humanSentiment === false) {
      throw InvalidInput(
        "You have already submitted feedback for this message."
      );
    }

    // Update the message with the feedback
    await updateMessageFeedback({ messageId, humanSentiment, comments });

    // Send feedback to LangSmith (fire-and-forget, non-blocking)
    // Only send if the message has a runId (some messages may not be traced)
    if (message.runId) {
      sendLangSmithFeedback({
        runId: message.runId,
        humanSentiment,
        comments,
      });
    }

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
