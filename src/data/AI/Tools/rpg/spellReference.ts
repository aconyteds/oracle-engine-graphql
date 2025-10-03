import { tool } from "@langchain/core/tools";
import { z } from "zod";

const spellReferenceSchema = z.object({
  spellName: z
    .string()
    .describe("Name of the spell to look up information for"),
});

export const spellReference = tool(
  (input: z.infer<typeof spellReferenceSchema>): string => {
    const normalizedSpellName = input.spellName
      .toLowerCase()
      .replace(/\s+/g, "");

    interface SpellInfo {
      level: number;
      school: string;
      description: string;
      damage?: string;
      healing?: string;
      duration?: string;
    }

    const knownSpells: SpellInfo[] = [
      {
        level: 3,
        school: "Evocation",
        description:
          "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.",
        damage: "8d6 fire damage",
      },
      {
        level: 1,
        school: "Evocation",
        description:
          "A creature of your choice that you can see within range regains hit points.",
        healing: "1d4 + spellcasting ability modifier",
      },
      {
        level: 1,
        school: "Evocation",
        description:
          "You create three glowing darts of magical force that automatically hit their targets.",
        damage: "1d4+1 force damage per dart",
      },
      {
        level: 1,
        school: "Abjuration",
        description:
          "An invisible barrier of magical force appears and protects you, giving +5 AC.",
        duration: "1 round",
      },
    ];

    const spellNames = ["fireball", "healingword", "magicmissile", "shield"];
    const spellIndex = spellNames.findIndex(
      (name) => name === normalizedSpellName
    );

    if (spellIndex !== -1) {
      const spell = knownSpells[spellIndex];
      const originalName = spellNames[spellIndex];
      const displayName =
        originalName === "healingword"
          ? "Healing Word"
          : originalName === "magicmissile"
            ? "Magic Missile"
            : originalName.charAt(0).toUpperCase() + originalName.slice(1);

      return `📜 **${displayName}** (Level ${spell.level} ${spell.school})\n${spell.description}\n${spell.damage || spell.healing || spell.duration || ""}`;
    }

    return `Spell "${input.spellName}" not found in reference. Try: Fireball, Healing Word, Magic Missile, Shield`;
  },
  {
    name: "spell_reference",
    description:
      "Provides basic information about common RPG spells. Input should be the spell name.",
    schema: spellReferenceSchema,
  }
);
