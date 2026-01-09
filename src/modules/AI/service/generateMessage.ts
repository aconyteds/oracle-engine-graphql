import * as Sentry from "@sentry/bun";
import { randomUUID } from "crypto";
import { AIMessage, BaseMessage, HumanMessage } from "langchain";
import { generateMessageWithAgent } from "../../../data/AI";
import { defaultRouter } from "../../../data/AI/Agents";
import { MessageQueue } from "../../../data/AI/MessageQueue";
import { MessageFactory } from "../../../data/AI/messageFactory";
import type { CampaignMetadata, RequestContext } from "../../../data/AI/types";
import { DBClient } from "../../../data/MongoDB";
import { checkRateLimit, incrementLLMUsage } from "../../../data/RateLimiting";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import {
  NotFoundError,
  ServerError,
  UnauthorizedAccessError,
} from "../../../graphql/errors";
import { getCampaign } from "../../Campaign/service/getCampaign";

export type GenerateMessageProps = {
  threadId: string;
  userId: string;
};

export async function* generateMessage(
  props: GenerateMessageProps
): AsyncGenerator<GenerateMessagePayload> {
  const { threadId, userId } = props;
  // Get the Thread with explicit user ownership check
  const thread = await DBClient.thread.findFirst({
    select: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
      campaignId: true,
      userId: true,
    },
    where: {
      id: threadId,
      userId: userId, // Ensure thread belongs to requesting user
    },
  });

  if (!thread) {
    throw new NotFoundError("Thread not found");
  }

  // Defense-in-depth: Verify thread ownership
  if (thread.userId !== userId) {
    throw new UnauthorizedAccessError("Unauthorized access to thread");
  }

  const { campaignId } = thread;

  // Fetch campaign metadata for context enrichment
  let campaignMetadata: CampaignMetadata | undefined;
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    // Verify campaign ownership to prevent cross-campaign data bleed
    if (campaign.ownerId !== userId) {
      throw new UnauthorizedAccessError("Unauthorized access to campaign");
    }

    campaignMetadata = {
      name: campaign.name,
      setting: campaign.setting,
      tone: campaign.tone,
      ruleset: campaign.ruleset,
    };
  } catch (error) {
    console.error("Failed to fetch campaign metadata:", error);
    // Re-throw security errors (NotFoundError, UnauthorizedAccessError), don't silently continue
    if (
      error instanceof NotFoundError ||
      error instanceof UnauthorizedAccessError
    ) {
      throw error;
    }
    // For other errors, continue without metadata rather than failing the request
  }

  // Check rate limit before processing
  let usageStatus;
  try {
    usageStatus = await checkRateLimit(userId);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      throw new NotFoundError("User not found");
    }
    throw error;
  }

  // If at limit, yield rate limit exceeded message and return early
  if (usageStatus.isAtLimit) {
    const rateLimitMessage = MessageFactory.rateLimitExceeded(
      usageStatus.maxCount
    );
    yield rateLimitMessage;
    return;
  }

  // Show warning if near limit (80%+ used)
  if (usageStatus.isNearLimit) {
    yield MessageFactory.rateLimitWarning(
      usageStatus.currentCount,
      usageStatus.maxCount
    );
  }

  const currAgent = defaultRouter;

  const messageHistory: BaseMessage[] = [];
  thread.messages.forEach((msg) => {
    if (msg.role === "user") {
      messageHistory.push(new HumanMessage(msg.content));
      return;
    }
    if (msg.role === "assistant") {
      messageHistory.push(new AIMessage(msg.content));
      return;
    }
  });

  const runId = randomUUID().toString(); // Unique ID for this workflow run

  // Create message queue for real-time streaming
  const messageQueue = new MessageQueue();

  // Enqueue function to pass down to agent and tools
  const enqueueMessage = (payload: GenerateMessagePayload) => {
    messageQueue.enqueue(payload);
  };

  // Create request context with deterministic values
  const requestContext: RequestContext = {
    userId,
    campaignId,
    threadId,
    runId,
    campaignMetadata,
    allowEdits: true, // Default to allowing edits, can be made configurable later
    // Yield message is required, but we will overwrite it. This is just to satisfy the type.
    yieldMessage: (payload: GenerateMessagePayload) => {
      console.debug("Notify User:", JSON.stringify(payload));
    },
  };

  // Start agent execution in background
  const agentPromise = generateMessageWithAgent({
    threadId,
    runId,
    agent: currAgent,
    messageHistory,
    requestContext,
    enqueueMessage,
  })
    .then(() => {
      messageQueue.complete();
    })
    .catch((error) => {
      messageQueue.error();
      Sentry.captureException(error, {
        extra: {
          threadId,
          runId,
          agentName: currAgent.name,
          requestContext,
          messageHistoryLength: messageHistory.length,
          reminder:
            "This error occurred during agent message generation streaming. This is likely a problem with the agent's internal processing. Use the runId to find the trace in LangSmith and investigate the chain to identify the root cause.",
        },
      });
      throw ServerError("Content Creation Failed", error);
    });

  // Consume queue and yield messages in real-time
  while (!messageQueue.isDone()) {
    // Check for errors before dequeuing
    if (messageQueue.hasErrorOccurred()) {
      const errorReason = messageQueue.getErrorReason();
      if (errorReason === "timeout") {
        throw ServerError(
          "Message generation timed out due to inactivity from the AI model. The allotted amount of time has passed without receiving a response."
        );
      }
      // For "agent_error", break and let the agentPromise.catch handle it
      break;
    }

    const message = await messageQueue.dequeue();
    if (message) {
      yield message;
    }
  }

  // Wait for agent to finish
  await agentPromise;

  // Increment usage after successful generation
  await incrementLLMUsage(userId);
}
