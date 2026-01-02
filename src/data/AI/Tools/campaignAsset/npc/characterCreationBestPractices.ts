import { tool } from "@langchain/core/tools";

export async function characterCreationBestPractices(): Promise<string> {
  return `# Character Creation Best Practices & Examples

## WHAT MAKES A GREAT NPC:

### Memorable:
- One or two DISTINCTIVE traits (physical, vocal, behavioral)
- A clear want or need players can interact with
- Unique speech pattern or catchphrase
- Sensory hook (smell of pipe smoke, jingling coins, raspy voice)

### Immersive:
- Feels like a real person with history and depth
- Reacts believably to player actions
- Has relationships beyond just the players
- Fits naturally in the world/setting

### Useful for Gameplay:
- Clear role in story/world (quest-giver, merchant, rival, ally, obstacle)
- Motivations create interesting choices for players
- Information or resources to offer
- Potential for memorable interactions

---

## EXAMPLE NPCs:

### Example 1 - Innkeeper:
**Name:** "Aldric Thornbrook"
**Summary:** "Gruff innkeeper with military past, secretly shelters refugees"
**PlayerSummary:** "The innkeeper at the Rusty Dragon, former soldier"
**PhysicalDescription:** "A stocky human male in his fifties, with a salt-and-pepper beard and a pronounced limp from an old war wound. His forearms bear faded military tattoos - a dragon and crossed swords. He smells faintly of pipe tobacco and hearty stew. His voice is gravelly but warm, carrying the weight of old stories."
**Motivation:** "Atone for past military violence by protecting the innocent. Fears authorities discovering his refugee operation and losing his inn. Wants to ensure his daughter inherits a business built on honor, not bloodshed."
**Mannerisms:** "Constantly polishes the same glass while talking, even when it's spotless. Calls everyone 'friend' or 'stranger' - never by name until they've earned his trust. Taps his bad leg three times when nervous. Says 'aye' instead of 'yes'."
**GmNotes:** "Runs underground railroad for refugees fleeing persecution. Has contacts in the thieves' guild. Former sergeant in the Dragon Company - committed war crimes he regrets. Knows location of Dragon Company's buried treasure. Stats: AC 12, HP 28, proficient with longsword. His daughter Mira doesn't know about his past."
**playerNotes:** "Aldric runs the Rusty Dragon Inn with his daughter. He's friendly to paying customers and known for his excellent stew. He walks with a limp and has military tattoos. The locals respect him."

### Example 2 - Mysterious Merchant:
**name:** "The Velvet Voice"
**summary:** "Enigmatic information broker who trades in secrets, not coin"
**playerSummary:** "A strange merchant who deals in information and favors"
**physicalDescription:** "A figure of indeterminate gender and race, always shrouded in shimmering purple velvet robes that seem to shift color in candlelight. Silver jewelry adorns every visible inch - rings, bangles, chains. Their voice is melodious and hypnotic, with an accent from no known land. The air around them carries the scent of exotic incense - sandalwood and something sweeter, almost cloying. Age impossible to determine - could be 30 or 300."
**motivation:** "Collect secrets to gain leverage over powerful figures across the realm. Seeks a specific piece of forbidden knowledge: the true name of the Demon Prince Azaleth. Wants to broker a deal between mortals and demons for personal gain and amusement."
**mannerisms:** "Speaks entirely in metaphors and riddles - 'The river knows what the mountain forgets.' Never makes direct eye contact, always looking just past the person. Fingers constantly writing invisible symbols in the air. Laughs softly at inappropriate moments. Hums an eerie tune when thinking."
**gmNotes:** "Actually a disguised night hag gathering souls for a demon pact. Has dirt on several city council members. Knows the players are prophesied to kill the Demon Prince - will try to manipulate them. Owns a Ring of Mind Shielding and Amulet of Proof Against Detection. Weaknesses: true name is Nyx'athara, can be banished with proper ritual. Has informants in every major city."
**playerNotes:** "This mysterious merchant appeared in town three months ago. They trade in secrets and favors rather than gold - 'A secret for a secret, a favor for a favor.' Nobody knows where they live or their real name. They seem to know things they shouldn't. The town guard tolerates them but keeps a wary eye."

---

## KEY TAKEAWAYS:

1. **Sensory Details Matter:** Notice how both examples include smell, sound, and visual details
2. **Layered Motivations:** Both characters have surface-level and deeper motivations
3. **Distinctive Mannerisms:** Each has unique quirks that make them instantly recognizable
4. **Secrets Create Depth:** Both have hidden layers that create interesting gameplay opportunities
5. **Clear Roles:** Each serves a specific purpose in the campaign (innkeeper/refuge-helper, information broker/manipulator)
6. **Physical + Personality:** Strong characters combine distinctive physical features with memorable personality traits`;
}

export const characterCreationBestPracticesTool = tool(
  characterCreationBestPractices,
  {
    name: "get_character_creation_best_practices",
    description:
      "Retrieves best practices, tips, and detailed examples for creating memorable, immersive NPCs. Use this when you need inspiration or guidance on how to create compelling characters with distinctive traits, sensory details, and layered motivations. Includes two complete example NPCs demonstrating excellent character design.",
  }
);
