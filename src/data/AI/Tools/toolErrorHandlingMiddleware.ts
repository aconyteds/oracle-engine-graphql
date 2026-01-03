import { ToolMessage } from "@langchain/core/messages";
import * as Sentry from "@sentry/bun";
import { createMiddleware } from "langchain";
import { MessageFactory } from "../messageFactory";
import type { RequestContext } from "../types";

/**
 * Middleware to handle tool input validation errors gracefully.
 *
 * When a tool's Zod schema validation fails (ToolInputParsingException),
 * this middleware catches the error and converts it into a ToolMessage
 * that the LLM can see and use to retry with corrected input.
 *
 * This prevents validation errors from crashing the entire workflow.
 */
export const toolErrorHandlingMiddleware = createMiddleware({
  name: "ToolErrorHandlingMiddleware",
  wrapToolCall: async (request, handler) => {
    try {
      // Attempt to execute the tool
      const result = await handler(request);
      return result;
    } catch (error) {
      // Check if this is a tool input validation error
      const isValidationError =
        error instanceof Error &&
        (error.message.includes(
          "Received tool input did not match expected schema"
        ) ||
          error.message.includes("ToolInputParsingException") ||
          error.constructor.name === "ToolInputParsingException");

      if (isValidationError) {
        // Log validation error for debugging
        console.warn(
          `Tool validation error for ${request.toolCall.name}:`,
          error.message
        );

        // Track validation errors in Sentry
        Sentry.metrics.count("tool_validation_error", 1, {
          attributes: {
            tool_name: request.toolCall.name,
          },
        });

        // Yield validation error message to user if yieldMessage is available
        const context = request.runtime.context as RequestContext | undefined;
        context?.yieldMessage(
          MessageFactory.error(
            `Tool validation failed for ${request.toolCall.name}`
          )
        );

        // Return error as a ToolMessage so the LLM can see it and retry
        // Extract the validation error details from the error message
        const errorDetails = error.message;

        return new ToolMessage({
          tool_call_id: request.toolCall.id ?? "",
          content: `<error>Tool input validation failed:\n\n${errorDetails}\n\nPlease review the tool schema and provide valid inputs that match all constraints (character limits, URL formats, etc.).</error>`,
        });
      }

      // For non-validation errors, re-throw
      throw error;
    }
  },
});
