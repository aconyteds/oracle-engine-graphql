import { ChatOpenAI } from "@langchain/openai";
import { createAgent, summarizationMiddleware, tool } from "langchain";
import { z } from "zod";
import { PrismaCheckpointSaver } from "./Checkpointers";
import { agentContextSchema, handoffRoutingResponseSchema } from "./schemas";
import { toolMonitoringMiddleware } from "./Tools";
import { type AIAgentDefinition, RequestContext, RouterType } from "./types";

// Create singleton checkpointer instance
let checkpointerInstance: PrismaCheckpointSaver | null = null;

function getCheckpointer(): PrismaCheckpointSaver {
  if (!checkpointerInstance) {
    checkpointerInstance = new PrismaCheckpointSaver();
  }
  return checkpointerInstance;
}

/**
 * Create a tool that wraps a sub-agent for supervisor pattern
 */
function createSubAgentTool(subAgent: AIAgentDefinition) {
  return tool(
    async (input: { request: string }, config) => {
      const subAgentInstance = getAgentDefinition(subAgent);
      const result = await subAgentInstance.invoke(
        { messages: [{ role: "user", content: input.request }] },
        {
          context: config.context,
          configurable: { thread_id: config.configurable?.thread_id },
        }
      );
      // Return the last message content from the sub-agent
      return result.messages[result.messages.length - 1].content as string;
    },
    {
      name: subAgent.name,
      description: subAgent.description,
      schema: z.object({
        request: z.string().describe("The request to pass to the sub-agent"),
      }),
    }
  );
}

export function getAgentDefinition(
  agent: AIAgentDefinition,
  requestContext?: RequestContext
): ReturnType<typeof createAgent> {
  const { model } = agent;
  let compositeThreadId = "";
  if (requestContext) {
    const { campaignId, threadId, userId } = requestContext;
    compositeThreadId = `${userId}:${threadId}:${campaignId}:${agent.name}`;
  }

  // Start with agent's own tools
  const tools = agent.availableTools ? [...agent.availableTools] : [];

  if (agent.routerType === RouterType.Controller) {
    // Supervisor pattern: Convert sub-agents to tools
    if (agent.availableSubAgents && agent.availableSubAgents.length > 0) {
      for (const subAgent of agent.availableSubAgents) {
        if (subAgent.routerType === RouterType.Handoff) {
          throw new Error(
            `Configuration Error: Controller agent '${agent.name}' cannot have Handoff sub-agent '${subAgent.name}'.`
          );
        }
        const subAgentTool = createSubAgentTool(subAgent);
        tools.push(subAgentTool);
      }
    }
  }

  let responseFormat = undefined;
  if (agent.routerType === RouterType.Handoff) {
    responseFormat = handoffRoutingResponseSchema;
  }

  // TODO:: Add logic to enrich system messages

  // Set prompt cache key for the model to enable caching
  if (compositeThreadId) {
    model.promptCacheKey = compositeThreadId;
  }
  const agentInstance = createAgent({
    model,
    tools,
    contextSchema: agentContextSchema,
    description: agent.description,
    name: agent.name,
    systemPrompt: agent.systemMessage,
    checkpointer: getCheckpointer(),
    middleware: [
      summarizationMiddleware({
        model: new ChatOpenAI({
          modelName: "gpt-5-nano",
          reasoning: {
            effort: "low",
          },
          ...(compositeThreadId
            ? { promptCacheKey: `${compositeThreadId}:summary` }
            : {}),
        }),
        trigger: { tokens: 100_000 },
        keep: {
          tokens: 10_000,
        },
      }),
      toolMonitoringMiddleware,
    ],
    ...(responseFormat ? { responseFormat } : {}),
  });
  return agentInstance;
}
