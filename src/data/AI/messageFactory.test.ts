import { describe, expect, test } from "bun:test";
import type { Message } from "../MongoDB";
import { MessageFactory } from "./messageFactory";

describe("MessageFactory", () => {
  const mockMessage: Message = {
    id: "msg-123",
    content: "Test message content",
    role: "assistant",
    threadId: "thread-123",
    tokenCount: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: [],
    runId: "run-123",
    routingMetadata: null,
    humanSentiment: null,
    feedbackComments: null,
  };

  test("Unit -> MessageFactory.progress returns correct payload", () => {
    const result = MessageFactory.progress("Creating asset");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "⚙️ Creating asset",
    });
  });

  test("Unit -> MessageFactory.toolUsage returns formatted tool names", () => {
    const result = MessageFactory.toolUsage([
      "create_npc",
      "find_campaign_asset",
    ]);

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "🛠️ Create Npc, Find Campaign Asset",
    });
  });

  test("Unit -> MessageFactory.toolUsage handles unknown tool names", () => {
    const result = MessageFactory.toolUsage(["unknown_tool"]);

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "🛠️ Unknown Tool",
    });
  });

  test("Unit -> MessageFactory.routing returns formatted agent name", () => {
    const result = MessageFactory.routing("character_agent");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "🔀 Routing to character ...",
    });
  });

  test("Unit -> MessageFactory.assetCreated returns correct payload with link", () => {
    const result = MessageFactory.assetCreated("NPC", "npc-123", "Elara");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "👤 Created [Elara](NPC:npc-123)",
    });
  });

  test("Unit -> MessageFactory.assetCreated uses correct emojis", () => {
    const npcResult = MessageFactory.assetCreated("NPC", "id1", "Name");
    const locationResult = MessageFactory.assetCreated(
      "Location",
      "id2",
      "Place"
    );
    const plotResult = MessageFactory.assetCreated("Plot", "id3", "Quest");

    expect(npcResult.content).toContain("👤");
    expect(locationResult.content).toContain("📍");
    expect(plotResult.content).toContain("📖");
  });

  test("Unit -> MessageFactory.assetUpdated returns correct payload with link", () => {
    const result = MessageFactory.assetUpdated("Location", "loc-123", "Tavern");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "📍 Updated [Tavern](Location:loc-123)",
    });
  });

  test("Unit -> MessageFactory.assetDeleted returns correct payload", () => {
    const result = MessageFactory.assetDeleted("Plot", "The Quest");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "🗑️ Deleted Plot: The Quest",
    });
  });

  test("Unit -> MessageFactory.searchResults returns correct payload with results", () => {
    const result = MessageFactory.searchResults(5, "wizard");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: '🔍 Found 5 results for "wizard"',
    });
  });

  test("Unit -> MessageFactory.searchResults handles singular result", () => {
    const result = MessageFactory.searchResults(1, "wizard");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: '🔍 Found 1 result for "wizard"',
    });
  });

  test("Unit -> MessageFactory.searchResults handles no results", () => {
    const result = MessageFactory.searchResults(0, "wizard");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: '🔍 No results found for "wizard"',
    });
  });

  test("Unit -> MessageFactory.final returns correct payload", () => {
    const result = MessageFactory.final(mockMessage);

    expect(result.responseType).toBe("Final");
    expect(result.content).toBe("Test message content");
    expect(result.message).toBeDefined();
    expect(result.message?.id).toBe("msg-123");
  });

  test("Unit -> MessageFactory.debug returns correct payload", () => {
    const result = MessageFactory.debug("Debug info");

    expect(result).toEqual({
      responseType: "Debug",
      content: "Debug info",
    });
  });

  test("Unit -> MessageFactory.error returns correct payload", () => {
    const result = MessageFactory.error("Something went wrong");

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "❌ Something went wrong",
    });
  });

  test("Unit -> MessageFactory.reasoning creates Reasoning response type", () => {
    const result = MessageFactory.reasoning("Analyzing user request");

    expect(result.responseType).toBe("Reasoning");
    expect(result.content).toBe("🧠 Analyzing user request");
  });

  test("Unit -> MessageFactory.reasoning formats content with emoji prefix", () => {
    const result = MessageFactory.reasoning("Calling tools: create_npc");

    expect(result).toEqual({
      responseType: "Reasoning",
      content: "🧠 Calling tools: create_npc",
    });
  });

  test("Unit -> MessageFactory.rateLimitWarning returns correct payload", () => {
    const result = MessageFactory.rateLimitWarning(20, 25);

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "You have 5 AI messages remaining today (20/25 used)",
    });
  });

  test("Unit -> MessageFactory.rateLimitWarning handles singular message", () => {
    const result = MessageFactory.rateLimitWarning(24, 25);

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "You have 1 AI message remaining today (24/25 used)",
    });
  });

  test("Unit -> MessageFactory.rateLimitWarning handles zero remaining", () => {
    const result = MessageFactory.rateLimitWarning(25, 25);

    expect(result).toEqual({
      responseType: "Intermediate",
      content: "You have 0 AI messages remaining today (25/25 used)",
    });
  });

  test("Unit -> MessageFactory.rateLimitExceeded returns correct payload", () => {
    const result = MessageFactory.rateLimitExceeded(25);

    expect(result).toEqual({
      responseType: "Intermediate",
      content:
        "Daily limit reached (25 messages). Your limit resets at midnight UTC. Consider upgrading your subscription for more messages.",
    });
  });

  test("Unit -> MessageFactory.rateLimitExceeded handles different limits", () => {
    const result = MessageFactory.rateLimitExceeded(150);

    expect(result.content).toContain("150 messages");
  });
});
