import { ServerError } from "../../../graphql/errors";
import {
  truncateMessageHistory,
  getAgentByName,
  getModelDefinition,
  generateMessageWithRouter,
  generateMessageWithStandardWorkflow,
} from "../../../data/AI";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import { DBClient } from "../../../data/MongoDB";
import { randomUUID } from "crypto";

export async function* generateMessage(
  threadId: string
): AsyncGenerator<GenerateMessagePayload> {
  // Get the Thread
  const thread = await DBClient.thread.findUnique({
    where: {
      id: threadId,
    },
    select: {
      userId: true,
      selectedAgent: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
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
    case "router":
      // Use router workflow for router agents
      yield* generateMessageWithRouter({
        threadId,
        agent: currAgent,
        messageHistory: truncatedMessageHistory,
        runId,
      });
      break;
    case "simple":
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
