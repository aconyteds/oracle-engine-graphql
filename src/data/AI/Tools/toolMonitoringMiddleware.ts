import * as Sentry from "@sentry/bun";
import { createMiddleware } from "langchain";

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
