import { Message, Thread, ThreadOptions } from "@prisma/client";
import { MessageRoles } from "../data/MongoDB";
import {
  Role as GraphQLRole,
  Message as GraphQLMessage,
  Thread as GraphQLThread,
  ThreadOptions as GraphQLThreadOptions,
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
