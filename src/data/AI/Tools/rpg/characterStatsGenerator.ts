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
  async (input: z.infer<typeof characterStatsSchema>): Promise<string> => {
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
        const rolls = Array.from(
          { length: 4 },
          () => Math.floor(Math.random() * 6) + 1
        );
        rolls.sort((a, b) => b - a);
        const total = rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
        return `${stat}: ${total}`;
      });
      return `**D&D 5e Character Stats:**\n${rolls.join("\n")}`;
    }

    // Generic stats
    const stats = Array.from(
      { length: 6 },
      () => Math.floor(Math.random() * 18) + 3
    );
    return `**Generic RPG Stats:** ${stats.join(", ")} (3-20 scale)`;
  },
  {
    name: "character_stats_generator",
    description:
      "Generates random character statistics for RPG characters. Input can specify the system (e.g., 'dnd5e', 'pathfinder', 'generic') or leave empty for generic stats.",
    schema: characterStatsSchema,
  }
);
