# Adding Tools to LangGraph Message Generation Workflow

## Overview

This guide demonstrates how to add tools to your LangGraph message generation workflow. Tools allow the AI model to call external functions, perform calculations, query databases, or interact with APIs to provide more dynamic and useful responses.

## Architecture

The tool-enabled workflow follows this pattern:

1. **Validate Input** - Ensures messages and tools are properly configured
2. **Generate with Tools** - AI model generates response, optionally calling tools
3. **Execute Tools** - If tools were called, execute them and get results
4. **Generate Final Response** - AI model generates final response incorporating tool results

## Implementation Files

- `src/data/AI/toolEnabledWorkflow.ts` - Main workflow implementation
- `src/data/AI/rpgTools.ts` - RPG-specific tool implementations
- `src/modules/AI/service/generateMessageWithTools.ts` - Service integration example

## Step-by-Step Guide

### 1. Create Your Tools

Tools are created using the `DynamicTool` class from LangChain. Each tool needs:

- `name`: Unique identifier for the tool
- `description`: Clear description of what the tool does and expected input format
- `func`: Async function that performs the actual work

```typescript
import { DynamicTool } from "@langchain/core/tools";

const myCustomTool = new DynamicTool({
  name: "weather_checker",
  description: "Gets current weather for a city. Input should be a city name.",
  func: async (cityName: string): Promise<string> => {
    // Your implementation here
    const weatherData = await fetchWeatherAPI(cityName);
    return `Weather in ${cityName}: ${weatherData.description}, ${weatherData.temperature}°F`;
  },
});
```

### 2. Create Tool Collections

Group related tools together:

```typescript
export const createWeatherTools = (): DynamicTool[] => [
  new DynamicTool({
    name: "current_weather",
    description: "Gets current weather for a location",
    func: async (location: string) => {
      // Implementation
    },
  }),

  new DynamicTool({
    name: "weather_forecast",
    description: "Gets weather forecast for a location",
    func: async (location: string) => {
      // Implementation
    },
  }),
];
```

### 3. Integrate Tools into Your Workflow

Use the tool-enabled workflow in your service:

```typescript
import { runToolEnabledWorkflow, createWeatherTools } from "../../../data/AI";

export async function* generateMessageWithWeatherTools(
  threadId: string
): AsyncGenerator<GenerateMessagePayload> {
  // ... existing setup code ...

  // Create your tools
  const tools = createWeatherTools();

  // Use tool-enabled workflow
  const result = await runToolEnabledWorkflow(
    truncatedMessageHistory,
    AIModel,
    tools,
    threadId
  );

  // Handle the result
  const finalResponse = result.currentResponse || "";
  // ... rest of implementation
}
```

### 4. Built-in RPG Tools

The system includes several RPG-specific tools:

#### Dice Roller

```typescript
// Usage: "Roll 2d6+3" or "Roll a d20"
name: "dice_roller";
description: "Rolls dice using standard RPG notation (e.g., '2d6+3', '1d20')";
```

#### Character Stats Generator

```typescript
// Usage: "Generate stats for D&D 5e" or "Create generic RPG stats"
name: "character_stats_generator";
description: "Generates random character statistics for RPG characters";
```

#### Random Encounter Generator

```typescript
// Usage: "Generate an easy encounter" or "Create a dungeon encounter"
name: "random_encounter";
description: "Generates random encounters for RPG sessions";
```

#### Spell Reference

```typescript
// Usage: "Look up Fireball" or "What does Shield do?"
name: "spell_reference";
description: "Provides basic information about common RPG spells";
```

#### Name Generator

```typescript
// Usage: "Generate a character name" or "Create a tavern name"
name: "name_generator";
description: "Generates random names for RPG characters, places, or items";
```

## Tool Best Practices

### 1. Clear Descriptions

Always provide clear, specific descriptions that tell the AI:

- What the tool does
- What input format is expected
- When to use the tool

```typescript
// Good
description: "Rolls dice using standard RPG notation (e.g., '2d6+3', '1d20'). Input should be dice notation as a string.";

// Bad
description: "Rolls dice";
```

### 2. Error Handling

Always include proper error handling in your tool functions:

```typescript
func: async (input: string): Promise<string> => {
  try {
    const result = await someAPICall(input);
    return `Success: ${result}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
};
```

### 3. Input Validation

Validate and sanitize inputs:

```typescript
func: async (diceNotation: string): Promise<string> => {
  const match = diceNotation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) {
    return "Invalid dice notation. Use format like '2d6', '1d20+5', etc.";
  }
  // Continue with processing...
};
```

### 4. Useful Output Formatting

Make tool outputs easy for the AI to understand and users to read:

```typescript
func: async (cityName: string): Promise<string> => {
  const weather = await getWeather(cityName);
  return `🌤️ **Weather in ${cityName}:**
Temperature: ${weather.temp}°F
Conditions: ${weather.description}
Humidity: ${weather.humidity}%`;
};
```

## Advanced Tool Features

### Database Integration

```typescript
new DynamicTool({
  name: "character_lookup",
  description: "Looks up a character's stats from the database",
  func: async (characterName: string): Promise<string> => {
    const character = await DBClient.character.findFirst({
      where: { name: characterName },
    });

    if (!character) {
      return `Character "${characterName}" not found.`;
    }

    return `**${character.name}** - Level ${character.level} ${character.class}
HP: ${character.hitPoints}
AC: ${character.armorClass}`;
  },
});
```

### External API Integration

```typescript
new DynamicTool({
  name: "spell_lookup",
  description: "Looks up spell information from D&D 5e API",
  func: async (spellName: string): Promise<string> => {
    try {
      const response = await fetch(
        `https://www.dnd5eapi.co/api/spells/${spellName.toLowerCase().replace(/\s+/g, "-")}`
      );
      const spell = await response.json();

      return `📜 **${spell.name}** (Level ${spell.level})
${spell.desc.join(" ")}
Range: ${spell.range}
Duration: ${spell.duration}`;
    } catch (error) {
      return `Could not find spell "${spellName}". Try checking the spelling.`;
    }
  },
});
```

## Testing Tools

Always test your tools with unit tests:

```typescript
import { describe, it, expect } from "bun:test";

describe("Custom Tools", () => {
  it("should execute weather tool correctly", async () => {
    const tools = createWeatherTools();
    const weatherTool = tools.find((tool) => tool.name === "current_weather");

    expect(weatherTool).toBeDefined();

    if (weatherTool) {
      const result = await weatherTool.func("New York");
      expect(result).toContain("Weather in New York");
    }
  });
});
```

## Workflow Configuration

### Conditional Tool Usage

You can create different tool sets for different agents or contexts:

```typescript
export const createToolsForAgent = (agentType: string): DynamicTool[] => {
  const baseTools = createRPGTools();

  switch (agentType) {
    case "dungeon_master":
      return [
        ...baseTools,
        ...createDMTools(), // Additional DM-only tools
      ];

    case "player":
      return baseTools.filter(
        (tool) => !["admin_tool", "dm_tool"].includes(tool.name)
      );

    default:
      return baseTools;
  }
};
```

### Performance Considerations

1. **Tool Timeouts**: Set reasonable timeouts for external API calls
2. **Caching**: Cache expensive operations when possible
3. **Rate Limiting**: Implement rate limiting for external APIs
4. **Error Recovery**: Provide fallback responses when tools fail

## Debugging Tools

Add debug information to your tools:

```typescript
func: async (input: string): Promise<string> => {
  console.log(`[${tool.name}] Called with input:`, input);

  try {
    const result = await processInput(input);
    console.log(`[${tool.name}] Success:`, result);
    return result;
  } catch (error) {
    console.error(`[${tool.name}] Error:`, error);
    return `Error in ${tool.name}: ${error.message}`;
  }
};
```

This comprehensive guide should help you understand and implement tools in your LangGraph message generation workflow. The key is to create useful, well-documented tools that enhance the AI's capabilities while maintaining good error handling and user experience.
