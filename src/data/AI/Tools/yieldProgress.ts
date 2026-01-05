import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MessageFactory } from "../messageFactory";
import type { RequestContext, ToolConfig } from "../types";

const yieldProgressSchema = z.object({
  message: z
    .string()
    .describe(
      "User-friendly progress message to display. Examples: 'Analyzing campaign assets...', 'Building character backstory...'"
    ),
});

type YieldProgressInput = z.infer<typeof yieldProgressSchema>;

export async function yieldProgressToUser(
  rawInput: YieldProgressInput,
  config: ToolConfig
): Promise<string> {
  const input = yieldProgressSchema.parse(rawInput);
  const context = config.context as RequestContext;
  const { yieldMessage } = context;

  if (!yieldMessage) {
    // This should never be a valid state, but just in case
    console.warn("yieldMessage not available in context");
    return "Progress message queued (no yield available)";
  }

  yieldMessage(MessageFactory.progress(input.message));
  return "message sent";
}

export const yieldProgressTool = tool(yieldProgressToUser, {
  name: "yield_progress",
  description:
    "Send a progress update to the user during long operations. Use this to keep the user informed about what you're doing. Call this frequently to prevent timeouts and keep the user updated on your progress.",
  schema: yieldProgressSchema,
});
