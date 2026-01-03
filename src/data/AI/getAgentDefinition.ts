import { ChatOpenAI } from "@langchain/openai";
import { createAgent, summarizationMiddleware, tool } from "langchain";
import { z } from "zod";
import { PrismaCheckpointSaver } from "./Checkpointers";
import { enrichInstructions } from "./enrichInstructions";
import { agentContextSchema, handoffRoutingResponseSchema } from "./schemas";
import {
  toolErrorHandlingMiddleware,
  toolMonitoringMiddleware,
  yieldProgressTool,
} from "./Tools";
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
      const subAgentInstance = await getAgentDefinition(subAgent);
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

export async function getAgentDefinition(
  agent: AIAgentDefinition,
  requestContext?: RequestContext
): Promise<ReturnType<typeof createAgent>> {
  const { model } = agent;
  let compositeThreadId = "";
  if (requestContext) {
    const { campaignId, threadId, userId } = requestContext;
    compositeThreadId = `${userId}:${threadId}:${campaignId}:${agent.name}`;
  }

  // Start with agent's own tools, use a Set to avoid duplicates
  const tools = new Set(agent.availableTools ? [...agent.availableTools] : []);
  // All agents get the yield progress tool becuase they need to report progress to prevent timeouts
  tools.add(yieldProgressTool);

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
        tools.add(subAgentTool);
      }
    }
  }

  let responseFormat = undefined;
  if (agent.routerType === RouterType.Handoff) {
    responseFormat = handoffRoutingResponseSchema;
  }

  // Enrich system message with campaign context if available
  const enrichedSystemMessage = await enrichInstructions({
    systemMessage: agent.systemMessage,
    campaignMetadata: requestContext
      ? requestContext.campaignMetadata
      : undefined,
  });

  // Set prompt cache key for the model to enable caching
  if (compositeThreadId) {
    model.promptCacheKey = compositeThreadId;
  }

  // Build middleware array
  const middleware = [
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
    toolErrorHandlingMiddleware, // Handle tool validation errors gracefully
    toolMonitoringMiddleware, // Monitor tool execution and log metrics
  ];

  // TODO: Add HITL middleware when allowEdits: false
  // Note: Human-in-the-loop middleware needs proper implementation based on langchain SDK
  // This will intercept delete_location tool calls when requestContext.allowEdits === false
  // Reference: https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop
  // if (requestContext?.allowEdits === false) {
  //   middleware.push(
  //     humanInTheLoopMiddleware({
  //       interruptOn: {
  //         delete_location: {
  //           allowedDecisions: ["approve", "reject"],
  //           description: "⚠️ This will permanently delete the location. Approve to proceed or reject to cancel.",
  //         },
  //       },
  //       descriptionPrefix: "Action requires approval",
  //     })
  //   );
  // }

  const agentInstance = createAgent({
    model,
    tools: Array.from(tools),
    contextSchema: agentContextSchema,
    description: agent.description,
    name: agent.name,
    systemPrompt: enrichedSystemMessage, // Use enriched system message
    checkpointer: getCheckpointer(),
    middleware, // Use middleware array
    ...(responseFormat ? { responseFormat } : {}),
  });
  return agentInstance;
}
