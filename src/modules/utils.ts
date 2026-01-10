import type {
  AIMessageChunk,
  MessageContentComplex,
} from "@langchain/core/messages";
import type { Campaign, Message, MessageRoles, Thread } from "../data/MongoDB";
import type {
  GenerateMessagePayload,
  Campaign as GraphQLCampaign,
  Message as GraphQLMessage,
  Role as GraphQLRole,
  Thread as GraphQLThread,
} from "../generated/graphql";

export const TranslateRole = (role: MessageRoles): GraphQLRole => {
  switch (role) {
    case "user":
      return "User";
    case "system":
      return "System";
    case "assistant":
    default:
      return "Assistant";
  }
};

export const TranslateMessage = (message: Message): GraphQLMessage => {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    threadId: message.threadId,
    role: TranslateRole(message.role as MessageRoles),
    tokenCount: message.tokenCount,
    workspace: message.workspace.map((entry) => ({
      messageType: entry.messageType,
      content: entry.content,
      timestamp: entry.timestamp.toISOString(),
      elapsedTime: entry.elapsedTime ?? null,
    })),
  };
};

export const TranslateThread = (thread: Thread): GraphQLThread => {
  return {
    id: thread.id,
    title: thread.userTitleOverride || thread.title,
    lastUsed: thread.updatedAt.toISOString(),
    campaignId: thread.campaignId,
    isPinned: thread.pinned,
    messages: [],
  };
};

export const TranslateAIChunk = (
  chunk: AIMessageChunk
): GenerateMessagePayload => {
  let content = "";
  if (typeof chunk.content === "string") {
    content = chunk.content;
  } else {
    const combinedContent = chunk.content.map((c: MessageContentComplex) => {
      if (c.type === "text") {
        return c.text as string;
      }
      if (c.type === "image_url") {
        return (c.image_url as { url?: string })?.url ?? "";
      }
      return "";
    });
    content = combinedContent.join(" ");
  }

  return {
    responseType: "Content",
    content,
  };
};

export const TranslateCampaign = (campaign: Campaign): GraphQLCampaign => {
  return {
    id: campaign.id,
    ownerId: campaign.ownerId,
    name: campaign.name,
    setting: campaign.setting,
    tone: campaign.tone,
    ruleset: campaign.ruleset,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
};
