import { tool } from "@langchain/core/tools";
import { z } from "zod";

const diceRollerSchema = z.object({
  diceNotation: z
    .string()
    .describe(
      "Dice notation using standard RPG format (e.g., '2d6+3', '1d20', '3d8-1')"
    ),
});

export const diceRoller = tool(
  async (input: z.infer<typeof diceRollerSchema>): Promise<string> => {
    try {
      // Parse dice notation like "2d6+3"
      const match = input.diceNotation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
      if (!match) {
        return "Invalid dice notation. Use format like '2d6', '1d20+5', etc.";
      }

      const numDice = parseInt(match[1] || "1");
      const diceSize = parseInt(match[2]);
      const modifier = parseInt(match[3] || "0");

      if (numDice > 100 || diceSize > 1000) {
        return "Dice values too large. Maximum 100 dice of size 1000.";
      }

      const rolls: number[] = [];
      let total = modifier;

      for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * diceSize) + 1;
        rolls.push(roll);
        total += roll;
      }

      return `🎲 Rolling ${input.diceNotation}: [${rolls.join(", ")}]${modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : ""} = **${total}**`;
    } catch (error) {
      return `Error rolling dice: ${error}`;
    }
  },
  {
    name: "dice_roller",
    description:
      "Rolls dice using standard RPG notation (e.g., '2d6+3', '1d20', '3d8-1'). Input should be dice notation as a string.",
    schema: diceRollerSchema,
  }
);
