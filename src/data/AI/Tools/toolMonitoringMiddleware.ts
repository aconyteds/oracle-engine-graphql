import * as Sentry from "@sentry/bun";
import { createMiddleware } from "langchain";

export const toolMonitoringMiddleware = createMiddleware({
  name: "ToolMonitoringMiddleware",
  wrapToolCall: (request, handler) => {
    const { context } = request.runtime;
    Sentry.metrics.count("tool_invocation", 1, {
      attributes: {
        tool_name: request.toolCall.name,
        ...(context && typeof context === "object" ? context : {}),
      },
    });
    console.debug(`Executing tool: ${request.toolCall.name}`);
    console.debug(`Arguments: ${JSON.stringify(request.toolCall.args)}`);
    try {
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
