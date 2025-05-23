import { ServerError } from "../../graphql/errors";
import { truncateMessageHistory, getAgentByName, getModelDefinition } from ".";
import type { MessageItem, RoleTypes } from ".";
import type { GenerateMessagePayload } from "../../generated/graphql";
import { TranslateAIChunk, TranslateMessage } from "../../modules/utils";
import { DBClient, saveMessage } from "../MongoDB";

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
  const { model, useHistory, systemMessage } = currAgent;
  const AIModel = getModelDefinition(currAgent);
  if (!AIModel) {
    throw ServerError("Invalid agent Configuration detected.");
  }
  const messageHistory: MessageItem[] = [];
  messageHistory.push({
    role: "system",
    content: systemMessage,
  });
  if (useHistory) {
    thread.messages.forEach((message) => {
      messageHistory.push({
        role: message.role as RoleTypes,
        content: message.content,
        tokenCount: message.tokenCount,
      });
    });
  } else {
    // Get the last user message
    const lastUserMessage = thread.messages
      .slice()
      .reverse()
      .find((message) => message.role === "user");

    messageHistory.push({
      role: "user",
      content: lastUserMessage?.content || "",
      tokenCount: lastUserMessage?.tokenCount,
    });
  }

  const truncatedMessageHistory = truncateMessageHistory({
    messageList: messageHistory,
    model,
  });

  const stream = await AIModel.stream(truncatedMessageHistory, {
    runId: threadId,
  });

  let runningData = "";
  for await (const chunk of stream) {
    const payload = TranslateAIChunk(chunk);
    runningData += payload.content;
    yield payload;
  }

  try {
    // After the stream ends, save the final message to the DB
    const savedMessage = await saveMessage({
      threadId,
      content: runningData,
      role: "assistant",
    });

    // Yield a final payload to the client
    const finalPayload: GenerateMessagePayload = {
      responseType: "Final",
      content: savedMessage.content,
      message: TranslateMessage(savedMessage),
    };
    yield finalPayload;
  } catch (error) {
    console.error("Error saving message:", error);
    throw ServerError("Error saving final message to the DataBase.");
  }
}
