import { tool } from "@langchain/core/tools";
import { z } from "zod";

const currentTimeSchema = z.object({});

export const currentTime = tool(
  (rawInput: unknown): string => {
    // Validate against schema even though it is empty to ensure consistent behavior
    currentTimeSchema.parse(rawInput);
    return `Current time: ${new Date().toISOString()} (UTC)`;
  },
  {
    name: "current_time",
    description: "Gets the current date and time",
    schema: currentTimeSchema,
  }
);
