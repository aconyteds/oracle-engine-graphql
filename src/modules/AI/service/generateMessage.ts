import { randomUUID } from "crypto";
import { AIMessage, BaseMessage, HumanMessage } from "langchain";
import { generateMessageWithAgent } from "../../../data/AI";
import { defaultRouter } from "../../../data/AI/Agents";
import type { RequestContext } from "../../../data/AI/types";
import { DBClient } from "../../../data/MongoDB";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import { ServerError } from "../../../graphql/errors";

export type GenerateMessageProps = {
  threadId: string;
  userId: string;
};

export async function* generateMessage(
  props: GenerateMessageProps
): AsyncGenerator<GenerateMessagePayload> {
  const { threadId, userId } = props;
  // Get the Thread
  const thread = await DBClient.thread.findUnique({
    select: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
      campaignId: true,
    },
    where: {
      id: threadId,
    },
  });

  if (!thread) {
    throw ServerError("Thread not found");
  }

  const { campaignId } = thread;

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

  // Create request context with deterministic values
  const requestContext: RequestContext = {
    userId,
    campaignId,
    threadId,
    runId,
  };

  // All agents now use the unified generation pattern
  yield* generateMessageWithAgent({
    threadId,
    runId,
    agent: currAgent,
    messageHistory,
    requestContext,
  });
}
