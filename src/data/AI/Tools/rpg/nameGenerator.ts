import { tool } from "@langchain/core/tools";
import { z } from "zod";

const nameGeneratorSchema = z.object({
  nameType: z
    .string()
    .optional()
    .describe(
      "Type of name to generate: 'character', 'place', 'city', 'town', 'tavern', 'inn', 'item', 'weapon', 'armor'. Defaults to 'character'"
    ),
});

export const nameGenerator = tool(
  async (input: z.infer<typeof nameGeneratorSchema>): Promise<string> => {
    const nameType = input.nameType || "character";
    const type = nameType.toLowerCase();

    if (type === "place" || type === "city" || type === "town") {
      const prefixes = [
        "Dragon",
        "Silver",
        "Golden",
        "Shadow",
        "Frost",
        "Stone",
        "Iron",
        "Moon",
        "Sun",
        "Star",
      ];
      const suffixes = [
        "haven",
        "ford",
        "burg",
        "dale",
        "moor",
        "ridge",
        "vale",
        "wick",
        "thorpe",
        "shire",
      ];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      return `🏰 **Place Name:** ${prefix}${suffix}`;
    }

    if (type === "tavern" || type === "inn") {
      const adjectives = [
        "Prancing",
        "Dancing",
        "Sleeping",
        "Drunken",
        "Golden",
        "Silver",
        "Red",
        "Black",
        "Merry",
      ];
      const nouns = [
        "Pony",
        "Dragon",
        "Unicorn",
        "Griffin",
        "Boar",
        "Lion",
        "Eagle",
        "Wolf",
        "Bear",
      ];
      const adjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      return `🍺 **Tavern Name:** The ${adjective} ${noun}`;
    }

    if (type === "item" || type === "weapon" || type === "armor") {
      const adjectives = [
        "Ancient",
        "Mystical",
        "Enchanted",
        "Cursed",
        "Legendary",
        "Forgotten",
        "Sacred",
        "Divine",
      ];
      const items = [
        "Sword",
        "Shield",
        "Bow",
        "Staff",
        "Ring",
        "Amulet",
        "Cloak",
        "Boots",
      ];
      const adjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];
      const item = items[Math.floor(Math.random() * items.length)];
      return `⚔️ **Item Name:** ${adjective} ${item}`;
    }

    // Default: character names
    const firstNames = [
      "Aelwyn",
      "Brenna",
      "Caelum",
      "Dara",
      "Ewan",
      "Fiora",
      "Gareth",
      "Hilda",
      "Ivan",
      "Jora",
    ];
    const lastNames = [
      "Brightblade",
      "Stormwind",
      "Ironforge",
      "Goldleaf",
      "Shadowmere",
      "Frostborn",
      "Starweaver",
      "Moonwhisper",
    ];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `👤 **Character Name:** ${firstName} ${lastName}`;
  },
  {
    name: "name_generator",
    description:
      "Generates random names for RPG characters, places, or items. Input can specify type: 'character', 'place', 'tavern', 'item', or leave empty for character names.",
    schema: nameGeneratorSchema,
  }
);
