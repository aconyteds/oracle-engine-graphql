import { describe, expect, test } from "bun:test";
import { ChatOpenAI } from "@langchain/openai";
import type { AIAgentDefinition } from "../../../types";
import { RouterType } from "../../../types";
import { buildAgentTopicMap } from "./buildAgentTopicMap";

describe("buildAgentTopicMap", () => {
  // Create mock agents for testing
  const mockCharacterAgent: AIAgentDefinition = {
    name: "character_generator",
    model: new ChatOpenAI({ model: "gpt-4" }),
    description: "Character creation agent",
    specialization: "character creation and management",
    systemMessage: "You help create characters",
    routerType: RouterType.None,
  };

  const mockLocationAgent: AIAgentDefinition = {
    name: "location_agent",
    model: new ChatOpenAI({ model: "gpt-4" }),
    description: "Location management agent",
    specialization: "location-based campaign assets like towns and dungeons",
    systemMessage: "You help with locations",
    routerType: RouterType.None,
  };

  const mockGeneralAgent: AIAgentDefinition = {
    name: "cheapest",
    model: new ChatOpenAI({ model: "gpt-4" }),
    description: "General purpose agent",
    specialization: "general questions",
    systemMessage: "You help with general tasks",
    routerType: RouterType.None,
  };

  test("Unit -> buildAgentTopicMap creates agentToKeywords mapping", () => {
    const topicMap = buildAgentTopicMap([mockCharacterAgent]);

    const keywords = topicMap.agentToKeywords.get("character_generator");
    expect(keywords).toEqual(["character", "creation", "management"]);
  });

  test("Unit -> buildAgentTopicMap creates keywordToAgents mapping", () => {
    const topicMap = buildAgentTopicMap([mockCharacterAgent]);

    expect(topicMap.keywordToAgents.get("character")).toEqual([
      "character_generator",
    ]);
    expect(topicMap.keywordToAgents.get("creation")).toEqual([
      "character_generator",
    ]);
    expect(topicMap.keywordToAgents.get("management")).toEqual([
      "character_generator",
    ]);
  });

  test("Unit -> buildAgentTopicMap handles multiple agents", () => {
    const topicMap = buildAgentTopicMap([
      mockCharacterAgent,
      mockLocationAgent,
    ]);

    expect(topicMap.agentToKeywords.get("character_generator")).toEqual([
      "character",
      "creation",
      "management",
    ]);
    expect(topicMap.agentToKeywords.get("location_agent")).toEqual([
      "location",
      "based",
      "campaign",
      "assets",
      "like",
      "towns",
      "dungeons",
    ]);
  });

  test("Unit -> buildAgentTopicMap handles shared keywords between agents", () => {
    const agent1: AIAgentDefinition = {
      ...mockCharacterAgent,
      specialization: "campaign character management",
    };
    const agent2: AIAgentDefinition = {
      ...mockLocationAgent,
      name: "plot_agent",
      specialization: "campaign plot development",
    };

    const topicMap = buildAgentTopicMap([agent1, agent2]);

    // "campaign" should map to both agents
    const campaignAgents = topicMap.keywordToAgents.get("campaign");
    expect(campaignAgents).toHaveLength(2);
    expect(campaignAgents).toContain("character_generator");
    expect(campaignAgents).toContain("plot_agent");
  });

  test("Unit -> buildAgentTopicMap handles empty agent list", () => {
    const topicMap = buildAgentTopicMap([]);

    expect(topicMap.agentToKeywords.size).toBe(0);
    expect(topicMap.keywordToAgents.size).toBe(0);
  });

  test("Unit -> buildAgentTopicMap handles agent with no keywords after filtering", () => {
    const emptyAgent: AIAgentDefinition = {
      ...mockGeneralAgent,
      specialization: "and the of", // Only stop words
    };

    const topicMap = buildAgentTopicMap([emptyAgent]);

    expect(topicMap.agentToKeywords.get("cheapest")).toEqual([]);
    expect(topicMap.keywordToAgents.size).toBe(0);
  });

  test("Unit -> buildAgentTopicMap preserves keyword order for each agent", () => {
    const topicMap = buildAgentTopicMap([mockLocationAgent]);

    const keywords = topicMap.agentToKeywords.get("location_agent");
    expect(keywords).toEqual([
      "location",
      "based",
      "campaign",
      "assets",
      "like",
      "towns",
      "dungeons",
    ]);
  });

  test("Unit -> buildAgentTopicMap handles real agent configurations", () => {
    const topicMap = buildAgentTopicMap([
      mockCharacterAgent,
      mockLocationAgent,
      mockGeneralAgent,
    ]);

    // Verify all agents are mapped
    expect(topicMap.agentToKeywords.size).toBe(3);

    // Verify character agent
    expect(topicMap.agentToKeywords.get("character_generator")).toContain(
      "character"
    );

    // Verify location agent
    expect(topicMap.agentToKeywords.get("location_agent")).toContain(
      "location"
    );

    // Verify general agent
    expect(topicMap.agentToKeywords.get("cheapest")).toEqual([
      "general",
      "questions",
    ]);

    // Verify reverse mappings
    expect(topicMap.keywordToAgents.get("character")).toEqual([
      "character_generator",
    ]);
    expect(topicMap.keywordToAgents.get("location")).toEqual([
      "location_agent",
    ]);
    expect(topicMap.keywordToAgents.get("general")).toEqual(["cheapest"]);
  });

  test("Unit -> buildAgentTopicMap deduplicates agents for shared keywords", () => {
    const agent1: AIAgentDefinition = {
      ...mockCharacterAgent,
      specialization: "character character character",
    };

    const topicMap = buildAgentTopicMap([agent1]);

    // Agent should only appear once in the keyword mapping
    expect(topicMap.keywordToAgents.get("character")).toEqual([
      "character_generator",
    ]);
  });

  test("Unit -> buildAgentTopicMap handles complex specializations", () => {
    const complexAgent: AIAgentDefinition = {
      ...mockCharacterAgent,
      name: "complex_agent",
      specialization:
        "multi-word/specialization_with-various (delimiters, separators)",
    };

    const topicMap = buildAgentTopicMap([complexAgent]);

    const keywords = topicMap.agentToKeywords.get("complex_agent");
    expect(keywords).toEqual([
      "multi",
      "word",
      "specialization",
      "various",
      "delimiters",
      "separators",
    ]);
  });
});
