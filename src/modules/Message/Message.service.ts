import { Message, PrismaClient } from "@prisma/client";
import { MessageModule } from "./generated";
import {
  createMessage,
  createThread,
  verifyThreadOwnership,
} from "../../data/MongoDB";
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { UnauthorizedError } from "../../graphql/errors";

type CreateMessageResponse = {
  // The Message that was added to the DB
  message: Message;
  // The ThreadID that the message was added to
  threadId: string;
};

export class MessageService {
  private _db!: PrismaClient;
  constructor(db: PrismaClient) {
    this._db = db;
  }

  public async createMessage(
    input: MessageModule.CreateMessageInput,
    userId: string
  ): Promise<CreateMessageResponse> {
    if (!input || !input.content) {
      throw new GraphQLError("Invalid user credentials", {
        extensions: {
          code: ApolloServerErrorCode.BAD_USER_INPUT,
        },
      });
    }

    let threadId = input.threadId;
    const { content } = input;
    if (!threadId) {
      // Create a new thread in the DB
      threadId = await createThread({
        client: this._db,
        message: input.content,
        userId,
      });
    } else {
      // Verify that the user has access to the thread
      try {
        await verifyThreadOwnership(this._db, threadId, userId);
      } catch (error) {
        throw UnauthorizedError();
      }
    }

    const message = await createMessage({
      client: this._db,
      threadId,
      content,
      role: "user",
    });

    return {
      threadId,
      message,
    };
  }
}
