import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const currentTime = tool(
  async (): Promise<string> => {
    return `Current time: ${new Date().toISOString()} (UTC)`;
  },
  {
    name: "current_time",
    description: "Gets the current date and time",
    schema: z.object({}), // Empty schema for tools that take no parameters
  }
);
