import { tool } from "@langchain/core/tools";
import { z } from "zod";

const calculatorSchema = z.object({
  expression: z
    .string()
    .describe(
      "Mathematical expression to calculate (e.g., '2+2', '10*5', '100/4')"
    ),
});

export const calculator = tool(
  async (input: z.infer<typeof calculatorSchema>): Promise<string> => {
    try {
      // Simple calculator - in production you'd want more sophisticated parsing
      const result = eval(
        input.expression.replace(/[^0-9+\-*/().]/g, "")
      ) as number;
      return `The result is: ${result}`;
    } catch (error) {
      return `Error calculating: ${error}`;
    }
  },
  {
    name: "calculator",
    description:
      "Performs basic arithmetic calculations. Input should be a mathematical expression as a string.",
    schema: calculatorSchema,
  }
);
