import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { Message } from "../MongoDB";
import { calculateTokenCount } from "./calculateTokenCount";
import type { AIAgentDefinition } from "./types";

type TruncationStrategy = "alternate" | "latest";

type TruncateMessageHistoryInput = {
  messageList: Message[];
  agent: AIAgentDefinition;
  truncationStrategy?: TruncationStrategy;
  maxContextPercentage?: number;
};

type MessagePair = [Message | undefined, Message | undefined];

/**
 * Truncates the message history to fit within the model's context window.
 *
 * @param params - The parameters for truncating the message history.
 * @returns An array of `BaseMessage` objects that fit within the context window.
 */
export const truncateMessageHistory = ({
  messageList,
  agent,
  truncationStrategy = "alternate",
  maxContextPercentage = 0.75,
}: TruncateMessageHistoryInput): BaseMessage[] => {
  if (!messageList.length) {
    return [];
  }

  const truncatedMessageList: BaseMessage[] = [];
  const { model, systemMessage } = agent;

  const maxTokens = Math.floor(model.contextWindow * maxContextPercentage);

  let totalTokens = 0;

  // Calculate the token count for the system message, this will allow us to reserve space for it
  if (systemMessage.length > 0) {
    totalTokens += calculateTokenCount(systemMessage);
  }

  const messagePairs = createMessagePairs(messageList);
  const selectedMessagePairs = selectMessages(
    messagePairs,
    truncationStrategy,
    maxTokens,
    totalTokens
  );

  // Convert selected pairs to BaseMessage objects and sort by createdAt
  const selectedMessages: { message: BaseMessage; createdAt: Date }[] = [];

  for (const pair of selectedMessagePairs) {
    const [currUserMessage, currAssistantMessage] = pair;

    if (currUserMessage) {
      selectedMessages.push({
        message: new HumanMessage(currUserMessage.content),
        createdAt: currUserMessage.createdAt,
      });
    }

    if (currAssistantMessage) {
      selectedMessages.push({
        message: new AIMessage(currAssistantMessage.content),
        createdAt: currAssistantMessage.createdAt,
      });
    }
  }

  // Sort by createdAt with oldest first
  selectedMessages.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Extract the BaseMessage objects
  truncatedMessageList.push(...selectedMessages.map((item) => item.message));

  return truncatedMessageList;
};

/**
 * Creates pairs of user and assistant messages from the message list.
 *
 * @param messageList - The list of messages to pair.
 * @returns An array of message pairs.
 */
function createMessagePairs(messageList: Message[]): MessagePair[] {
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

function selectMessages(
  messagePairs: MessagePair[],
  truncationStrategy: TruncationStrategy,
  maxTokens: number,
  systemTokens: number
): MessagePair[] {
  switch (truncationStrategy) {
    case "alternate":
      return selectMessagePairsAlternate(messagePairs, maxTokens, systemTokens);
    case "latest":
      return selectMessagePairsLatest(messagePairs, maxTokens, systemTokens);
    default:
      const exhaustiveCheck: never = truncationStrategy;
      throw new Error(
        `Invalid truncation strategy: ${String(exhaustiveCheck)}`
      );
  }
}

/**
 * Selects message pairs by alternating between the end and start of the array until token limit is reached.
 *
 * @param messagePairs - The message pairs to select from.
 * @param maxTokens - Maximum tokens allowed.
 * @param systemTokens - Tokens already used by system message.
 * @returns The selected message pairs.
 */
function selectMessagePairsAlternate(
  messagePairs: MessagePair[],
  maxTokens: number,
  systemTokens: number
): MessagePair[] {
  const selectedMessagePairs: MessagePair[] = [];
  let totalTokens = systemTokens;
  let start = 0;
  let end = messagePairs.length - 1;
  let takeFromEnd = true;

  while (start <= end) {
    const currentPair = takeFromEnd ? messagePairs[end] : messagePairs[start];
    const [currUserMessage, currAssistantMessage] = currentPair;

    const userTokens = currUserMessage
      ? currUserMessage.tokenCount ||
        calculateTokenCount(currUserMessage.content)
      : 0;
    const assistantTokens = currAssistantMessage
      ? currAssistantMessage.tokenCount ||
        calculateTokenCount(currAssistantMessage.content)
      : 0;

    if (totalTokens + userTokens + assistantTokens <= maxTokens) {
      totalTokens += userTokens + assistantTokens;
      selectedMessagePairs.push(currentPair);
    }

    // Always advance to next position regardless of whether we added the pair
    if (takeFromEnd) {
      end--;
    } else {
      start++;
    }
    takeFromEnd = !takeFromEnd;
  }

  return selectedMessagePairs;
}

/**
 * Selects message pairs by taking the latest messages first until token limit is reached.
 *
 * @param messagePairs - The message pairs to select from.
 * @param maxTokens - Maximum tokens allowed.
 * @param systemTokens - Tokens already used by system message.
 * @returns The selected message pairs.
 */
function selectMessagePairsLatest(
  messagePairs: MessagePair[],
  maxTokens: number,
  systemTokens: number
): MessagePair[] {
  const selectedMessagePairs: MessagePair[] = [];
  let totalTokens = systemTokens;

  // Start from the end (most recent) and work backwards
  for (let i = messagePairs.length - 1; i >= 0; i--) {
    const [currUserMessage, currAssistantMessage] = messagePairs[i];

    const userTokens = currUserMessage
      ? currUserMessage.tokenCount ||
        calculateTokenCount(currUserMessage.content)
      : 0;
    const assistantTokens = currAssistantMessage
      ? currAssistantMessage.tokenCount ||
        calculateTokenCount(currAssistantMessage.content)
      : 0;

    if (totalTokens + userTokens + assistantTokens > maxTokens) {
      continue; // Skip this pair and try the next one
    }

    totalTokens += userTokens + assistantTokens;
    selectedMessagePairs.push(messagePairs[i]);
  }

  return selectedMessagePairs;
}
