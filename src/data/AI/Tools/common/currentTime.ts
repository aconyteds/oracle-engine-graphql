import { tool } from "langchain";
import { z } from "zod";

const currentTimeSchema = z.object({});

export const currentTime = tool(
  async (_input, _context) => {
    return `Current time: ${new Date().toISOString()} (UTC)`;
  },
  {
    name: "current_time",
    description: "Gets the current date and time",
    schema: currentTimeSchema,
  }
);
