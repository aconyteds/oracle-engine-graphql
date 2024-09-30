import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DEFAULT_OPENAI_MODEL } from "./DefaultModels";

export const createTitle = async (message: string): Promise<string> => {
  // Use langchain to talk with OpenAI to generate a title using the Message provided by the user
  const systemMessage = new SystemMessage(
    "Use the Message provided to generate a short title for a conversation. This title should be no more than 3 words, less than 75 characters in length. It should be the same language as the message provided. It should summarize the message in a way that is easy to understand."
  );
  const userMessage = new HumanMessage(message);
  const response = await DEFAULT_OPENAI_MODEL.generate(
    [[systemMessage, userMessage]],
    {
      options: {
        stream: false,
      },
    }
  );

  return response.generations[0][0].text;
};
