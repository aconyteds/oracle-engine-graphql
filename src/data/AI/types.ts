import type { DynamicStructuredTool, Tool } from "@langchain/core/tools";
import type { ClientOptions } from "@langchain/openai";

import type { TrustedModel } from "./modelList";

export type AIAgentDefinition = {
  name: string;
  model: TrustedModel;
  description: string;
  systemMessage: string;
  useHistory: boolean;
  clientConfigurationOverrides?: ClientOptions;
  availableTools?: (Tool | DynamicStructuredTool)[];
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
