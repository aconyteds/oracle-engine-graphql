import type { DynamicTool } from "@langchain/core/tools";
import { cheapest } from "../Agents";
import { getAgentByName } from "../agentList";
import { getModelDefinition } from "../getModelDefinition";
import type { RoutingDecision } from "../types";
import type { RouterGraphState } from "../Workflows/routerWorkflow";
import { runToolEnabledWorkflow } from "../Workflows/toolEnabledWorkflow";

export async function analyzeAndRoute(state: typeof RouterGraphState.State) {
  const startTime = Date.now();

  try {
    // Use the router agent from the workflow state
    const routerAgent = state.routerAgent;
    if (!routerAgent) {
      throw new Error("Router agent not provided in workflow state");
    }

    const model = getModelDefinition(routerAgent);
    if (!model) {
      throw new Error("Router model not configured");
    }

    // Use Router agent to analyze the request
    const response = await runToolEnabledWorkflow({
      messages: state.messages,
      threadId: state.runId,
      agent: routerAgent,
      tools: routerAgent.availableTools as DynamicTool[],
    });

    // Extract routing decision from tool calls
    const routingDecision = extractRoutingDecision(response as WorkflowResult);

    const executionTime = Date.now() - startTime;

    return {
      ...state,
      routingDecision,
      routingAttempts: state.routingAttempts + 1,
      routingMetadata: {
        decision: routingDecision,
        executionTime,
        success: !!routingDecision,
        fallbackUsed: false,
      },
    };
  } catch (error) {
    console.error("Router analysis failed:", error);

    // Create fallback routing decision
    const fallbackDecision: RoutingDecision = {
      targetAgent: cheapest,
      confidence: 50,
      reasoning: "Router analysis failed, using default agent",
      fallbackAgent: cheapest,
      intentKeywords: [],
      contextFactors: ["routing_error"],
      routedAt: new Date(),
      routingVersion: "1.0",
    };

    return {
      ...state,
      routingDecision: fallbackDecision,
      routingAttempts: state.routingAttempts + 1,
      routingMetadata: {
        decision: fallbackDecision,
        executionTime: Date.now() - startTime,
        success: false,
        fallbackUsed: true,
      },
    };
  }
}

interface WorkflowResult {
  toolResultsForDB?: Array<{
    toolName: string;
    result: string;
  }>;
}

interface RoutingDecisionResult {
  type: string;
  targetAgent: string;
  confidence: number;
  reasoning: string;
  fallbackAgent: string;
  intentKeywords: string[];
  contextFactors: string[];
  timestamp: string;
}

function extractRoutingDecision(
  workflowResult: WorkflowResult
): RoutingDecision | null {
  try {
    // Parse tool calls to find routing decision
    if (workflowResult.toolResultsForDB) {
      for (const toolResult of workflowResult.toolResultsForDB) {
        if (toolResult.toolName === "routeToAgent") {
          const decision = JSON.parse(
            toolResult.result
          ) as RoutingDecisionResult;
          if (decision.type === "routing_decision") {
            // Validate target agent exists
            const targetAgentDefinition = getAgentByName(decision.targetAgent);
            if (!targetAgentDefinition) {
              throw new Error(
                `Agent "${decision.targetAgent}" not found in agent list`
              );
            }

            let fallbackAgentDefinition = cheapest;
            // Validate fallback agent or set default
            if (decision.fallbackAgent) {
              const potentialFallback = getAgentByName(decision.fallbackAgent);
              if (!potentialFallback) {
                throw new Error(
                  `Fallback agent "${decision.fallbackAgent}" not found`
                );
              }
              fallbackAgentDefinition = potentialFallback;
            }
            return {
              targetAgent: targetAgentDefinition,
              confidence: decision.confidence,
              reasoning: decision.reasoning,
              fallbackAgent: fallbackAgentDefinition,
              intentKeywords: decision.intentKeywords,
              contextFactors: decision.contextFactors,
              routedAt: new Date(decision.timestamp),
              routingVersion: "1.0",
            };
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to extract routing decision:", error);
    return null;
  }
}
