import { MessageFactory } from "./messageFactory";
import type {
  MessageContentBlock,
  StreamChunk,
  StreamChunkContent,
  YieldMessageFunction,
} from "./types";

/**
 * LangGraph stream step types
 * @see https://docs.langchain.com/oss/javascript/langgraph/streaming#supported-stream-modes
 */
export enum StreamStepType {
  /** Model invocation step - includes LLM calls with reasoning and tool calls */
  MODEL_REQUEST = "model_request",
  /** Tool execution step - includes tool invocations and results */
  TOOLS = "tools",
  /** Final agent state - includes complete conversation and structured response */
  AGENT = "agent",
}

/**
 * Type guard to validate stream chunk content structure
 */
function isStreamChunkContent(value: unknown): value is StreamChunkContent {
  return (
    typeof value === "object" &&
    value !== null &&
    ("messages" in value || "structuredResponse" in value)
  );
}

/**
 * Type guard to check if a message has content blocks (OpenAI Responses API)
 */
function hasContentBlocks(
  msg: unknown
): msg is { contentBlocks: MessageContentBlock[] } {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "contentBlocks" in msg &&
    Array.isArray(msg.contentBlocks)
  );
}

/**
 * Type guard to check if a message has extended thinking (potential future format)
 */
function hasThinking(msg: unknown): msg is { thinking: string } {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "thinking" in msg &&
    typeof msg.thinking === "string"
  );
}

/**
 * Process stream updates from LangChain agent.stream()
 * Extracts reasoning blocks from model responses across different LLM providers
 * Skips tool steps as tools already call yieldMessage() themselves
 *
 * Supports:
 * - OpenAI Responses API (contentBlocks with reasoning)
 * - Future reasoning formats (thinking property)
 * - Provider-agnostic message processing
 */
export async function processStreamUpdate(
  chunk: StreamChunk,
  yieldMessage: YieldMessageFunction
): Promise<void> {
  // Extract step type and content from chunk
  // Chunk format: { [stepType]: {...} }
  const entries = Object.entries(chunk);

  if (entries.length === 0) {
    console.debug("[processStreamUpdate] Empty chunk, skipping");
    return;
  }

  const [step, rawContent] = entries[0];

  // Validate content structure
  if (!isStreamChunkContent(rawContent)) {
    console.debug(
      `[processStreamUpdate] Unexpected content format for step: ${step}`
    );
    return;
  }

  const content = rawContent as StreamChunkContent;

  // Only process model request steps - tools already handle their own progress
  if (step === StreamStepType.MODEL_REQUEST) {
    const messages = content.messages || [];

    if (messages.length === 0) {
      return;
    }

    const lastMsg = messages[messages.length - 1];

    // Try multiple reasoning formats for provider compatibility
    if (hasContentBlocks(lastMsg)) {
      // OpenAI Responses API format (o1, o3 models)
      for (const block of lastMsg.contentBlocks) {
        if (block.type === "reasoning" && block.reasoning) {
          const payload = MessageFactory.reasoning(block.reasoning);
          yieldMessage(payload);
        }
      }
    } else if (hasThinking(lastMsg)) {
      // Future/alternative reasoning format
      const payload = MessageFactory.reasoning(lastMsg.thinking);
      yieldMessage(payload);
    }
  }
  // Explicitly skip TOOLS and AGENT steps - they're handled elsewhere
}
