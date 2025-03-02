import type { Message, Thread, ThreadOptions } from "@prisma/client";
import type {
  AIMessageChunk,
  MessageContentComplex,
} from "@langchain/core/messages";

import type { MessageRoles } from "../data/MongoDB";
import type {
  Role as GraphQLRole,
  Message as GraphQLMessage,
  Thread as GraphQLThread,
  ThreadOptions as GraphQLThreadOptions,
  GenerateMessagePayload,
} from "../generated/graphql";

export const TranslateRole = (role: MessageRoles): GraphQLRole => {
  switch (role) {
    case "user":
      return "User";
    case "system":
      return "System";
    case "assistant":
    case "tool_calls":
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
  };
};

export const TranslateThread = (thread: Thread): GraphQLThread => {
  return {
    id: thread.id,
    title: thread.title,
    lastUsed: thread.updatedAt.toISOString(),
    messages: [],
    threadOption: thread.threadOptions
      ? TranslateThreadOptions(thread.threadOptions)
      : null,
  };
};

export const TranslateThreadOptions = (
  threadOptions: ThreadOptions
): GraphQLThreadOptions => {
  return {
    model: threadOptions.model,
    systemMessage: threadOptions.systemMessage,
    temperature: threadOptions.temperature,
    useHistory: threadOptions.useHistory,
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
        return c.text;
      }
      if (c.type === "image_url") {
        return c.image_url;
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
