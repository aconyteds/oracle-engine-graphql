import { tool } from "@langchain/core/tools";
import { z } from "zod";

const characterStatsSchema = z.object({
  system: z
    .string()
    .optional()
    .describe(
      "The RPG system to generate stats for (e.g., 'dnd5e', 'pathfinder', 'generic'). Defaults to 'generic'"
    ),
});

export const characterStatsGenerator = tool(
  (rawInput: unknown): Promise<string> => {
    const input = characterStatsSchema.parse(rawInput);
    const system = input.system || "generic";
    const normalizedSystem = system.toLowerCase().replace(/\s+/g, "");

    if (normalizedSystem === "dnd5e" || normalizedSystem === "d&d5e") {
      const stats = [
        "Strength",
        "Dexterity",
        "Constitution",
        "Intelligence",
        "Wisdom",
        "Charisma",
      ];
      const rolls = stats.map((stat) => {
        // 4d6 drop lowest method
        const diceRolls = Array.from(
          { length: 4 },
          () => Math.floor(Math.random() * 6) + 1
        );
        diceRolls.sort((a, b) => b - a);
        const total = diceRolls
          .slice(0, 3)
          .reduce((sum, roll) => sum + roll, 0);
        return `${stat}: ${total}`;
      });
      return Promise.resolve(
        `**D&D 5e Character Stats:**\n${rolls.join("\n")}`
      );
    }

    // Generic stats
    const stats = Array.from(
      { length: 6 },
      () => Math.floor(Math.random() * 18) + 3
    );
    return Promise.resolve(
      `**Generic RPG Stats:** ${stats.join(", ")} (3-20 scale)`
    );
  },
  {
    name: "character_stats_generator",
    description:
      "Generates random character statistics for RPG characters. Input can specify the system (e.g., 'dnd5e', 'pathfinder', 'generic') or leave empty for generic stats.",
    schema: characterStatsSchema,
  }
);
