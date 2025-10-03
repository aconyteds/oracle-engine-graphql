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
  (rawInput: unknown): Promise<string> => {
    const input = diceRollerSchema.parse(rawInput);
    try {
      // Parse dice notation like "2d6+3"
      const match = input.diceNotation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
      if (!match) {
        return Promise.resolve(
          "Invalid dice notation. Use format like '2d6', '1d20+5', etc."
        );
      }

      const numDice = parseInt(match[1] || "1");
      const diceSize = parseInt(match[2]);
      const modifier = parseInt(match[3] || "0");

      if (numDice > 100 || diceSize > 1000) {
        return Promise.resolve(
          "Dice values too large. Maximum 100 dice of size 1000."
        );
      }

      const rolls: number[] = [];
      let total = modifier;

      for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * diceSize) + 1;
        rolls.push(roll);
        total += roll;
      }

      const modifierString =
        modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";
      const summary = `🎲 Rolling ${input.diceNotation}: [${rolls.join(", ")}]${modifierString} = **${total}**`;
      return Promise.resolve(summary);
    } catch (error) {
      return Promise.resolve(`Error rolling dice: ${String(error)}`);
    }
  },
  {
    name: "dice_roller",
    description:
      "Rolls dice using standard RPG notation (e.g., '2d6+3', '1d20', '3d8-1'). Input should be dice notation as a string.",
    schema: diceRollerSchema,
  }
);
