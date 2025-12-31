import { tool } from "@langchain/core/tools";

export async function plotCreationBestPractices(): Promise<string> {
  return `# Plot Creation Best Practices & Examples

## WHAT MAKES A GREAT PLOT:

### Engaging:
- Clear stakes - what happens if players succeed or fail?
- Personal hooks - why should players care?
- Player agency - meaningful choices that matter
- Multiple resolution paths - avoid railroading
- Appropriate pacing - when to escalate urgency

### Memorable:
- Strong central conflict or mystery
- Unexpected twists and revelations
- Connections to character backstories
- Clues that reward investigation
- Consequences that ripple through the campaign

### DM-Friendly:
- Flexible structure that adapts to player choices
- Clear next steps and contingencies
- NPC/Location relationships clearly defined
- Secrets organized by when/how players discover them
- Status/Urgency tracking for campaign management

---

## STORY FRAMEWORKS:

### Three-Act Structure:
Act 1 - Setup: Introduce plot, establish stakes, present hook
Act 2 - Confrontation: Complications arise, challenges escalate
Act 3 - Resolution: Climax and consequences

### Mystery Framework:
Hook: Intriguing event or question
Clues: Evidence players can discover (multiple paths)
Red Herrings: Misdirection (use sparingly)
Revelation: Truth revealed through investigation
Consequences: What changes based on outcome

### Conflict Types:
- Person vs Person: Villain, rival, opposing faction
- Person vs Nature: Environmental threat, natural disaster
- Person vs Society: Corrupt system, cultural clash
- Person vs Self: Moral dilemma, character growth

---

## EXAMPLE PLOTS:

### Example 1 - Mystery Plot:
**Name:** "The Missing Merchant Prince"
**Summary:** "Wealthy heir vanished from locked tower; rival families suspect foul play"
**PlayerSummary:** "Lord Castellan hires you to find his missing son before war erupts"
**GmNotes:** "STAKES: If not found in 3 days, rival families go to war (200+ casualties). If players expose the truth, they gain powerful enemy.

KEY NPCs: Lord Castellan (father, desperate, will pay 1000gp), Lady Seraphine (rival matriarch, secretly innocent), Marcus the Jester (actual kidnapper, resentful former servant).

LOCATIONS: Castellan Tower (locked room mystery, secret passage in north wall), Seraphine Estate (red herring evidence planted), Hidden Shrine (where victim is held).

SECRETS:
- Victim's younger brother Marcus (now court jester) orchestrated kidnapping
- Marcus was bastard son, cast out when 'legitimate' heir born
- Victim still alive in Hidden Shrine, drugged but unharmed
- Real plan: Frame Seraphine family, inherit fortune in chaos

CLUES:
- Locked room has secret passage (Perception DC 15 on north wall)
- Jester's chambers have shrine plans (Investigation DC 12)
- Apothecary sold sleeping draught to 'masked buyer' matching Marcus's height
- Victim's signet ring found near Hidden Shrine (planted by Marcus)

ALTERNATIVE PATHS:
- Social: Question witnesses, earn Seraphine's trust, expose Marcus
- Investigation: Follow clues, discover passage, track drug purchase
- Combat: Confront Marcus, rescue victim before he flees
- Magical: Scrying, speak with dead on 'murdered' guard

CONTINGENCIES:
- If players suspect Seraphine: Marcus feeds them false evidence
- If players take too long: Marcus 'finds' body (fake), war begins
- If players ally with Marcus: He betrays them after inheriting"

**SharedWithPlayers:** "Lord Castellan's heir vanished from a locked tower three nights ago. The door was barred from inside, windows shuttered. His rival, Lady Seraphine, denies involvement but benefits most from his death. Lord Castellan offers 1000 gold pieces for his son's safe return. You have three days before the families go to war."

**Status:** InProgress
**Urgency:** TimeSensitive

### Example 2 - Action Plot:
**Name:** "Siege of Thornwatch"
**Summary:** "Orc warband besieges border town; players must break siege or evacuate"
**PlayerSummary:** "Thornwatch is under siege. You're inside with 200 civilians and dwindling supplies"
**GmNotes:** "STAKES: Success = town saved, 200 lives. Failure = town falls, refugee crisis, orcs push deeper into kingdom.

KEY NPCs: Captain Ironwood (garrison commander, pragmatic, wants to fight), Elder Thornberry (mayor, wants evacuation, knows secret escape tunnel), Grimjaw (orc warchief, honorable, will accept single combat).

LOCATIONS: Thornwatch (fortified town, 2 weeks supplies left), Secret Tunnel (leads 2 miles outside siege line, only Elder knows), Orc Camp (300 warriors, can be sabotaged).

SECRETS:
- Elder Thornberry has secret tunnel (built decades ago, forgotten by others)
- Grimjaw challenges town to single combat (honorable duel tradition)
- Orc warband is fleeing something worse - undead army 3 days behind
- If orcs defeated, players face undead army alone
- Kingdom reinforcements 5 days away (too late)

CLUES:
- Orc scouts seem terrified, looking over shoulders
- Elder nervous about 'old family secret'
- Orc campfires show fear rituals, not victory celebrations
- Messages from kingdom reinforcements delayed

ALTERNATIVE PATHS:
- Combat: Break siege with surprise attack via secret tunnel
- Diplomacy: Learn about undead threat, ally with orcs against common enemy
- Stealth: Evacuate civilians through secret tunnel, abandon town
- Mixed: Negotiate orc retreat, prepare for undead army together
- Champion: Accept Grimjaw's single combat challenge (high risk)

CONSEQUENCES:
- If evacuate: Refugee crisis, players seen as cowards by some
- If fight orcs alone: Pyrrhic victory, unprepared for undead
- If ally with orcs: Political scandal, but best chance vs undead
- If do nothing: Town falls in 2 weeks (starvation)

PACING:
Day 1-3: Investigation, discover tunnel/combat option
Day 4-5: Learn about undead threat (scouting or orc prisoner)
Day 6-7: Make decision, prepare for chosen path
Day 8+: Execute plan, face consequences"

**SharedWithPlayers:** "You're trapped inside Thornwatch with 200 civilians. The orc warband has the town surrounded - 300 warriors to your garrison of 40. Supplies will last two weeks. Captain Ironwood wants to fight. Elder Thornberry wants to find another way. The orcs haven't attacked yet... they're waiting for something."

**Status:** InProgress
**Urgency:** Critical

---

## KEY TAKEAWAYS:

1. **Clear Stakes:** Both examples show what happens if players succeed/fail
2. **Multiple Paths:** Combat, social, stealth, magic - all viable
3. **Layered Secrets:** Not everything revealed immediately; rewards investigation
4. **NPC/Location Links:** Specific relationships defined for relatedAssets
5. **Pacing Guidance:** When urgency escalates, what triggers next phase
6. **Player Agency:** Meaningful choices with different consequences
7. **DM Flexibility:** Contingencies for different player approaches
8. **Status/Urgency Tracking:** Both examples show appropriate values

## COMMON PITFALLS TO AVOID:

1. **Single Solution:** Always provide multiple resolution paths
2. **No Stakes:** Players need to care about success/failure
3. **Railroading:** Plot should adapt to player choices, not force specific actions
4. **Information Overload:** Reveal secrets gradually through play
5. **Unclear Objectives:** Players should always know what they can do next
6. **Disconnected:** Link plots to NPCs, locations, other plots via relatedAssets
7. **Static Status:** Update status/urgency as plot progresses
8. **No Consequences:** Player choices should matter and ripple forward`;
}

export const plotCreationBestPracticesTool = tool(plotCreationBestPractices, {
  name: "get_plot_creation_best_practices",
  description:
    "Retrieves best practices, story frameworks, and detailed examples for creating engaging, well-structured plots. Use when you need inspiration, guidance on plot design, or examples demonstrating excellent story structure. Includes two complete example plots (mystery and action) with all fields fully populated.",
});
