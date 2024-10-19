import { PrismaClient } from "@prisma/client";
import { ServerError } from "../../graphql/errors";
import {
  DEFAULT_OPENAI_MODEL,
  truncateMessageHistory,
  TrustedModelName,
} from "../../data/AI";
import { MessageItem, RoleTypes } from "../../data/AI";
import { GenerateMessagePayload } from "../../generated/graphql";
import { TranslateAIChunk, TranslateMessage } from "../utils";
import { createMessage } from "../../data/MongoDB";

export class AIService {
  private readonly _db: PrismaClient;
  public constructor(db: PrismaClient) {
    this._db = db;
  }

  public async *generateMessage(
    threadId: string
  ): AsyncGenerator<GenerateMessagePayload> {
    // Get the Thread
    const thread = await this._db.thread.findUnique({
      where: {
        id: threadId,
      },
      select: {
        userId: true,
        threadOptions: true,
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

    const { model, useHistory, systemMessage } = thread.threadOptions;
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
      modelName: model as TrustedModelName,
    });

    const stream = await DEFAULT_OPENAI_MODEL.stream(truncatedMessageHistory, {
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
      const savedMessage = await createMessage({
        client: this._db,
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
}
