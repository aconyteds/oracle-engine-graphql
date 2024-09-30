import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import { TRUSTED_MODELS, TrustedModelName } from "./modelList";
import { calculateTokenCount } from "./calculateTokenCount";
import { RoleTypes } from ".";

export type MessageItem = {
  content: string;
  tokenCount?: number;
  role: RoleTypes;
};

type TruncationStrategy = "alternate" | "latest";

type TruncateMessageHistoryInput = {
  messageList: MessageItem[];
  modelName: TrustedModelName;
  truncationStrategy?: TruncationStrategy;
  maxContextPercentage?: number;
};

type MessagePair = [MessageItem | undefined, MessageItem | undefined];

/**
 * Truncates the message history to fit within the model's context window.
 *
 * @param params - The parameters for truncating the message history.
 * @returns An array of `BaseMessage` objects that fit within the context window.
 */
export const truncateMessageHistory = ({
  messageList,
  modelName,
  truncationStrategy = "alternate",
  maxContextPercentage = 0.75,
}: TruncateMessageHistoryInput): BaseMessage[] => {
  if (!messageList.length) {
    return [];
  }

  const model = TRUSTED_MODELS.get(modelName);
  const truncatedMessageList: BaseMessage[] = [];

  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }

  const maxTokens = Math.floor(model.contextWindow * maxContextPercentage);

  let totalTokens = 0;

  // Get the first system message from the list, and remove the rest
  let systemMessage: MessageItem | undefined;

  // Filter out system messages
  messageList = messageList.filter((message) => {
    // get rid of empty messages
    if (!message.content) {
      return false;
    }
    // Keep user and assistant messages
    if (message.role === "user" || message.role === "assistant") {
      return true;
    }
    // If we find a system message, keep it and remove the rest
    if (message.role === "system" && !systemMessage) {
      // We take the first system message we find to pass as instructions to the AI
      systemMessage = message;
    }
    return false;
  });

  // Calculate the token count for the system message
  if (systemMessage) {
    totalTokens +=
      systemMessage.tokenCount || calculateTokenCount(systemMessage.content);
    truncatedMessageList.push(new SystemMessage(systemMessage.content));
  }

  const messagePairs = createMessagePairs(messageList);
  const orderedMessagePairs = orderMessages(messagePairs, truncationStrategy);

  // Temporary list to collect messages
  const tempMessageList: BaseMessage[] = [];

  // Process the ordered message pairs and handle potential undefined messages
  for (const pair of orderedMessagePairs) {
    const [currUserMessage, currAssistantMessage] = pair;

    const userTokens = currUserMessage
      ? currUserMessage.tokenCount ||
        calculateTokenCount(currUserMessage.content)
      : 0;
    const assistantTokens = currAssistantMessage
      ? currAssistantMessage.tokenCount ||
        calculateTokenCount(currAssistantMessage.content)
      : 0;

    if (totalTokens + userTokens + assistantTokens > maxTokens) {
      break;
    }

    totalTokens += userTokens + assistantTokens;

    if (currUserMessage) {
      tempMessageList.push(new HumanMessage(currUserMessage.content));
    }

    if (currAssistantMessage) {
      tempMessageList.push(new AIMessage(currAssistantMessage.content));
    }
  }

  // Reverse to maintain chronological order
  truncatedMessageList.push(...tempMessageList.reverse());

  return truncatedMessageList;
};

/**
 * Creates pairs of user and assistant messages from the message list.
 *
 * @param messageList - The list of messages to pair.
 * @returns An array of message pairs.
 */
function createMessagePairs(messageList: MessageItem[]): MessagePair[] {
  const messagePairs: MessagePair[] = [];
  let currentPair: MessagePair = [undefined, undefined];

  for (const message of messageList) {
    // Calculate token count if not already present
    if (message.tokenCount === undefined) {
      message.tokenCount = calculateTokenCount(message.content);
    }

    if (message.role === "user") {
      if (currentPair[0] || currentPair[1]) {
        messagePairs.push(currentPair);
      }
      currentPair = [message, undefined];
    } else if (message.role === "assistant") {
      if (!currentPair[0]) {
        currentPair = [undefined, message];
        messagePairs.push(currentPair);
        currentPair = [undefined, undefined];
      } else {
        currentPair[1] = message;
        messagePairs.push(currentPair);
        currentPair = [undefined, undefined];
      }
    }
  }

  // Push the last pair if it has at least one message
  if (currentPair[0] || currentPair[1]) {
    messagePairs.push(currentPair);
  }

  return messagePairs;
}

function orderMessages(
  messagePairs: MessagePair[],
  truncationStrategy: TruncationStrategy
): MessagePair[] {
  switch (truncationStrategy) {
    case "alternate":
      return orderMessagePairsAlternate(messagePairs);
    case "latest":
      return orderMessagePairsLatest(messagePairs);
    default:
      throw new Error(`Invalid truncation strategy: ${truncationStrategy}`);
  }
}

/**
 * Orders message pairs by alternating between the end and start of the array.
 *
 * @param messagePairs - The message pairs to order.
 * @returns The ordered message pairs.
 */
function orderMessagePairsAlternate(
  messagePairs: MessagePair[]
): MessagePair[] {
  const orderedMessagePairs: MessagePair[] = [];
  let start = 0;
  let end = messagePairs.length - 1;
  let takeFromEnd = true;

  while (start <= end) {
    if (takeFromEnd) {
      orderedMessagePairs.push(messagePairs[end--]);
    } else {
      orderedMessagePairs.push(messagePairs[start++]);
    }
    takeFromEnd = !takeFromEnd;
  }

  return orderedMessagePairs;
}

/**
 * Orders message pairs by taking the latest messages first.
 *
 * @param messagePairs - The message pairs to order.
 * @returns The ordered message pairs.
 */
function orderMessagePairsLatest(messagePairs: MessagePair[]): MessagePair[] {
  return messagePairs.slice().reverse();
}
