import type { BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type {
  DynamicStructuredTool,
  Tool,
  ToolRunnableConfig,
} from "@langchain/core/tools";
import type { ClientOptions } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import type { ToolCall as LangChainToolCall } from "langchain";
import type { GenerateMessagePayload } from "../../generated/graphql";

export enum RouterType {
  None = "none",
  Handoff = "handoff",
  Controller = "controller",
}

export type AIAgentDefinition = {
  name: string;
  model: ChatOpenAI;
  description: string;
  // This is a string that indicates to the LLM what this agent is best at handling.
  // It should be a short phrase, like "math problems" or "travel recommendations".
  // This is used in multi-agent systems to route tasks to the appropriate agent.
  specialization: string;
  systemMessage: string;
  clientConfigurationOverrides?: ClientOptions;
  availableTools?: (Tool | DynamicStructuredTool)[];
  availableSubAgents?: AIAgentDefinition[];
  routingExamples?: RoutingExample[];
  maxRetries?: number;
  retryDelayMs?: number;
  maxToolCalls?: number;
  maxToolCallTimeMs?: number;
  routerType: RouterType;
};

// Tool call interface definition
export interface ToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

// Interface for database storage
export interface ToolCallForDB {
  toolName: string;
  arguments: string;
  toolCallId?: string;
  dateOccurred: Date;
}

export interface ToolResultForDB {
  toolName: string;
  result: string;
  toolCallId?: string;
  elapsedTime?: number;
  dateOccurred: Date;
}

// Router-specific types
export interface RoutingExample {
  userRequest: string;
  confidence: number;
  reasoning?: string;
}

export interface RoutingDecision {
  targetAgent: AIAgentDefinition;
  confidence: number;
  reasoning: string;
  fallbackAgent: AIAgentDefinition;
  intentKeywords: string[];
  contextFactors: string[];
  routedAt: Date;
  routingVersion: string;
}

export interface RoutingMetadata {
  decision: RoutingDecision;
  executionTime: number;
  success: boolean;
  fallbackUsed: boolean;
  userSatisfaction?: number;
}

export interface RouterWorkflowState {
  originalMessage: string;
  conversationHistory: BaseMessage[];
  routingDecision?: RoutingDecision;
  routingAttempts: number;
  maxRoutingAttempts: number;
  isRouted: boolean;
  targetAgentResult?: unknown;
  routingMetadata?: RoutingMetadata;
}

// Campaign metadata for enriching agent context
export interface CampaignMetadata {
  name: string;
  setting: string;
  tone: string;
  ruleset: string;
}

/**
 * Function type for yielding progress messages from tools.
 * Tools can call this to send real-time updates to the UI.
 * Synchronously enqueues messages to the queue for real-time streaming.
 */
export type YieldMessageFunction = (payload: GenerateMessagePayload) => void;

// Request context for passing deterministic values to tools
export interface RequestContext {
  userId: string; // Database user ID
  campaignId: string; // Database campaign ID
  threadId: string; // Database thread ID
  runId: string; // LangSmith trace ID
  campaignMetadata?: CampaignMetadata; // Optional campaign context for enrichment
  allowEdits?: boolean; // Controls human-in-the-loop for destructive operations (default: true)
  yieldMessage: YieldMessageFunction; // Optional function for yielding progress messages to the UI
}

// Generic tool configuration type for tool function signatures
// This handles the various config shapes that LangChain can pass to tool functions
export type ToolConfig =
  | Record<string, any>
  | ToolRunnableConfig
  | (Record<string, any> &
      RunnableConfig<Record<string, any>> & {
        toolCall?: LangChainToolCall;
        context?: any;
      });

/**
 * Content block types from LangChain's message content
 * These mirror the ContentBlock types from @langchain/core/messages
 * Used when processing messages from OpenAI's Responses API with reasoning models
 */
export interface TextContentBlock {
  type: "text";
  text: string;
  index?: number;
  [key: string]: unknown; // Allow additional properties for LangChain compatibility
}

export interface ReasoningContentBlock {
  type: "reasoning";
  reasoning: string;
  index?: number;
  [key: string]: unknown; // Allow additional properties for LangChain compatibility
}

export type MessageContentBlock = TextContentBlock | ReasoningContentBlock;

/**
 * Message content can be either a string or array of content blocks
 */
export type MessageContent = string | MessageContentBlock[];

/**
 * AI Message with content blocks and tool calls
 * Used for processing stream updates
 */
export interface AIMessageWithBlocks {
  type: string;
  contentBlocks?: MessageContentBlock[];
  tool_calls?: ToolCall[];
}

/**
 * Stream chunk content structure from LangChain
 */
export interface StreamChunkContent {
  messages?: AIMessageWithBlocks[];
  structuredResponse?: unknown; // Can be HandoffRoutingResponse or other structured responses
}

/**
 * Stream chunk from LangChain agent
 * Using Record<string, unknown> to accept the complex LangChain chunk structure
 * which may include additional state management properties
 */
export type StreamChunk = Record<string, unknown>;
