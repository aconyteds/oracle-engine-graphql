import type { DynamicStructuredTool, Tool } from "@langchain/core/tools";
import type { ClientOptions } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";

import type { TrustedModel } from "./modelList";

export type AIAgentDefinition = {
  name: string;
  model: TrustedModel;
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
  routerType: "simple" | "router";
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
