import { tool } from "@langchain/core/tools";
import { z } from "zod";

const randomEncounterSchema = z.object({
  input: z
    .string()
    .optional()
    .describe(
      "Specify difficulty level ('easy', 'medium', 'hard') or environment ('dungeon', 'wilderness', 'city'). Leave empty for random encounter."
    ),
});

export const randomEncounter = tool(
  (input: { input?: string }): string => {
    const encounterInput = input.input || "";
    const normalizedInput = encounterInput.toLowerCase();

    let encounterList: string[] = [];

    // Difficulty-based encounters
    if (normalizedInput === "easy") {
      encounterList = [
        "A friendly merchant offers to trade supplies",
        "You discover a small cache of coins hidden under a loose stone",
        "A curious squirrel approaches, seemingly wanting to help",
        "You find fresh water and a safe place to rest",
      ];
    } else if (normalizedInput === "medium") {
      encounterList = [
        "A group of bandits blocks the path ahead",
        "An ancient puzzle door stands before you",
        "A wounded traveler asks for your aid",
        "Strange magical energy emanates from nearby crystals",
      ];
    } else if (normalizedInput === "hard") {
      encounterList = [
        "A fierce dragon swoops down from above",
        "The ground begins to crack and lava seeps through",
        "A powerful wizard challenges you to a duel",
        "An army of undead rises from the nearby graveyard",
      ];
    }
    // Environment-based encounters
    else if (normalizedInput === "dungeon") {
      encounterList = [
        "Echoing footsteps suggest you're not alone in these halls",
        "A hidden treasure chest is visible behind a locked gate",
        "Mysterious runes glow faintly on the wall",
        "You hear the sound of rushing water from a hidden passage",
      ];
    } else if (normalizedInput === "wilderness") {
      encounterList = [
        "A pack of wolves watches you from the treeline",
        "Storm clouds gather quickly overhead",
        "You discover the ruins of an ancient settlement",
        "A river blocks your path with no obvious crossing",
      ];
    } else if (normalizedInput === "city") {
      encounterList = [
        "A pickpocket attempts to steal from your purse",
        "A crowd gathers around a street performer",
        "Guard patrol approaches asking for identification",
        "A mysterious figure in a hooded cloak beckons you to follow",
      ];
    } else {
      // Generic encounter pool
      encounterList = [
        "A friendly merchant offers to trade supplies",
        "A group of bandits blocks the path ahead",
        "You discover ancient ruins in the distance",
        "Strange magical energy fills the air",
        "A mysterious figure watches you from afar",
        "You find evidence of recent campfires",
      ];
    }

    const encounter =
      encounterList[Math.floor(Math.random() * encounterList.length)];
    return `🎲 **Random Encounter:** ${encounter}`;
  },
  {
    name: "random_encounter",
    description:
      "Generates a random encounter or event for RPG sessions. Input can specify difficulty level ('easy', 'medium', 'hard') or environment ('dungeon', 'wilderness', 'city').",
    schema: randomEncounterSchema,
  }
);
