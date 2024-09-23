import { TranslateMessage } from "../utils";
import { MessageModule } from "./generated";
import { MessageService } from "./Message.service";

// TODO:: Setup broadcast for a thread when a message is created

const MessageResolvers: MessageModule.Resolvers = {
  Mutation: {
    createMessage: async (
      _,
      { input },
      { db, userId }
    ): Promise<MessageModule.CreateMessagePayload> => {
      const messageService = new MessageService(db);
      const { message, threadId } = await messageService.createMessage(
        input,
        userId
      );

      return {
        threadId,
        message: TranslateMessage(message),
      };
    },
  },
};

export default MessageResolvers;
