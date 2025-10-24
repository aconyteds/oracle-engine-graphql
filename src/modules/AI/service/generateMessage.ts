import { randomUUID } from "crypto";
import {
  generateMessageWithRouter,
  generateMessageWithStandardWorkflow,
  getAgentByName,
  getModelDefinition,
  RouterType,
  truncateMessageHistory,
} from "../../../data/AI";
import { DBClient } from "../../../data/MongoDB";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import { ServerError } from "../../../graphql/errors";

export async function* generateMessage(
  threadId: string
): AsyncGenerator<GenerateMessagePayload> {
  // Get the Thread
  const thread = await DBClient.thread.findUnique({
    select: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
      selectedAgent: true,
      userId: true,
    },
    where: {
      id: threadId,
    },
  });

  if (!thread) {
    throw ServerError("Thread not found");
  }

  const currAgent = getAgentByName(thread.selectedAgent);
  if (!currAgent) {
    throw ServerError("Invalid agent selected.");
  }
  const AIModel = getModelDefinition(currAgent);
  if (!AIModel) {
    throw ServerError("Invalid agent Configuration detected.");
  }

  const truncatedMessageHistory = truncateMessageHistory({
    messageList: thread.messages,
    agent: currAgent,
  });

  const runId = randomUUID().toString(); // Unique ID for this workflow run

  // Route to appropriate workflow based on agent type
  switch (currAgent.routerType) {
    case RouterType.Router:
      // Use router workflow for router agents
      yield* generateMessageWithRouter({
        threadId,
        agent: currAgent,
        messageHistory: truncatedMessageHistory,
        runId,
      });
      break;
    case RouterType.Simple:
    default:
      // Use standard workflow for leaf agents
      yield* generateMessageWithStandardWorkflow({
        threadId,
        agent: currAgent,
        messageHistory: truncatedMessageHistory,
        runId,
      });
      break;
  }
}
