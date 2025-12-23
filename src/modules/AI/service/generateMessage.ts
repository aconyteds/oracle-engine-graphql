import { randomUUID } from "crypto";
import { AIMessage, BaseMessage, HumanMessage } from "langchain";
import { generateMessageWithAgent } from "../../../data/AI";
import { defaultRouter } from "../../../data/AI/Agents";
import type { CampaignMetadata, RequestContext } from "../../../data/AI/types";
import { DBClient } from "../../../data/MongoDB";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import { ServerError } from "../../../graphql/errors";
import { getCampaign } from "../../Campaign/service/getCampaign";

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

  // Fetch campaign metadata for context enrichment
  let campaignMetadata: CampaignMetadata | undefined;
  try {
    const campaign = await getCampaign(campaignId);
    if (campaign) {
      campaignMetadata = {
        name: campaign.name,
        setting: campaign.setting,
        tone: campaign.tone,
        ruleset: campaign.ruleset,
      };
    }
  } catch (error) {
    console.error("Failed to fetch campaign metadata:", error);
    // Continue without metadata rather than failing the request
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

  // Create request context with deterministic values
  const requestContext: RequestContext = {
    userId,
    campaignId,
    threadId,
    runId,
    campaignMetadata,
    allowEdits: true, // Default to allowing edits, can be made configurable later
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
