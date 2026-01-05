import * as Sentry from "@sentry/bun";
import { createMiddleware } from "langchain";
import { MessageFactory } from "../messageFactory";
import { RequestContext } from "../types";

/**
 * Middleware for monitoring and logging tool invocations.
 *
 * This middleware focuses on:
 * - Logging tool execution for debugging
 * - Tracking metrics in Sentry
 * - Capturing exceptions for error monitoring
 */
export const toolMonitoringMiddleware = createMiddleware({
  name: "ToolMonitoringMiddleware",
  wrapToolCall: (request, handler) => {
    Sentry.metrics.count("tool_invocation", 1, {
      // Ensure we keep Cardinality low
      attributes: {
        tool_name: request.toolCall.name,
      },
    });
    console.debug(`Executing tool: ${request.toolCall.name}`);
    console.debug(`Arguments: ${JSON.stringify(request.toolCall.args)}`);
    try {
      // Yield validation error message to user if yieldMessage is available
      const context = request.runtime.context as RequestContext | undefined;
      context?.yieldMessage(MessageFactory.toolUsage([request.toolCall.name]));

      const result = handler(request);
      return result;
    } catch (e) {
      Sentry.captureException(e, {
        extra: {
          toolName: request.toolCall.name,
          args: request.toolCall.args,
        },
      });
      throw e;
    }
  },
});
