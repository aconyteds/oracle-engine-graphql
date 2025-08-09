import type {
  AIMessageChunk,
  MessageContentComplex,
} from "@langchain/core/messages";

import type { Message, Thread } from "../data/MongoDB";
import type { MessageRoles } from "../data/MongoDB";
import type {
  Role as GraphQLRole,
  Message as GraphQLMessage,
  Thread as GraphQLThread,
  GenerateMessagePayload,
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
    title: thread.title,
    lastUsed: thread.updatedAt.toISOString(),
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
