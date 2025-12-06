import { describe, expect, test } from "bun:test";
import {
  type AgentContextSchema,
  agentContextSchema,
  type HandoffRoutingResponse,
  handoffRoutingResponseSchema,
} from "./schemas";

describe("schemas", () => {
  describe("agentContextSchema", () => {
    test("Unit -> agentContextSchema validates valid context", () => {
      const validContext = {
        campaignId: "campaign-123",
        userId: "user-456",
        threadId: "thread-789",
        runId: "run-abc",
      };

      const result = agentContextSchema.safeParse(validContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validContext);
      }
    });

    test("Unit -> agentContextSchema rejects missing fields", () => {
      const invalidContext = {
        campaignId: "campaign-123",
        userId: "user-456",
        // missing threadId and runId
      };

      const result = agentContextSchema.safeParse(invalidContext);

      expect(result.success).toBe(false);
    });

    test("Unit -> agentContextSchema rejects wrong types", () => {
      const invalidContext = {
        campaignId: 123, // should be string
        userId: "user-456",
        threadId: "thread-789",
        runId: "run-abc",
      };

      const result = agentContextSchema.safeParse(invalidContext);

      expect(result.success).toBe(false);
    });

    test("Unit -> agentContextSchema type inference works correctly", () => {
      // This is a compile-time test to ensure type inference works
      const context: AgentContextSchema = {
        campaignId: "campaign-123",
        userId: "user-456",
        threadId: "thread-789",
        runId: "run-abc",
      };

      expect(context.campaignId).toBe("campaign-123");
    });
  });

  describe("handoffRoutingResponseSchema", () => {
    test("Unit -> handoffRoutingResponseSchema validates valid response", () => {
      const validResponse = {
        targetAgent: "location_agent",
        confidence: 4,
        reasoning: "User is asking about location details",
        fallbackAgent: "general_agent",
        intentKeywords: ["location", "place", "where"],
        contextFactors: ["previous location queries", "campaign context"],
      };

      const result = handoffRoutingResponseSchema.safeParse(validResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validResponse);
      }
    });

    test("Unit -> handoffRoutingResponseSchema validates minimal valid response", () => {
      const minimalResponse = {
        targetAgent: "location_agent",
        confidence: 3,
        reasoning: "User needs location assistance",
        fallbackAgent: "",
        intentKeywords: ["location"],
        contextFactors: [],
      };

      const result = handoffRoutingResponseSchema.safeParse(minimalResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetAgent).toBe("location_agent");
        expect(result.data.fallbackAgent).toBe("");
        expect(result.data.contextFactors).toEqual([]);
      }
    });

    test("Unit -> handoffRoutingResponseSchema rejects confidence out of range", () => {
      const invalidResponse = {
        targetAgent: "location_agent",
        confidence: 10, // max is 5
        reasoning: "User needs help",
        fallbackAgent: "",
        intentKeywords: ["location"],
        contextFactors: [],
      };

      const result = handoffRoutingResponseSchema.safeParse(invalidResponse);

      expect(result.success).toBe(false);
    });

    test("Unit -> handoffRoutingResponseSchema rejects short reasoning", () => {
      const invalidResponse = {
        targetAgent: "location_agent",
        confidence: 3,
        reasoning: "short", // min length is 10
        fallbackAgent: "",
        intentKeywords: ["location"],
        contextFactors: [],
      };

      const result = handoffRoutingResponseSchema.safeParse(invalidResponse);

      expect(result.success).toBe(false);
    });

    test("Unit -> handoffRoutingResponseSchema rejects missing required fields", () => {
      const invalidResponse = {
        targetAgent: "location_agent",
        confidence: 3,
        // missing reasoning and intentKeywords
      };

      const result = handoffRoutingResponseSchema.safeParse(invalidResponse);

      expect(result.success).toBe(false);
    });

    test("Unit -> handoffRoutingResponseSchema type inference works correctly", () => {
      // This is a compile-time test to ensure type inference works
      const response: HandoffRoutingResponse = {
        targetAgent: "location_agent",
        confidence: 4,
        reasoning: "User is asking about location details",
        fallbackAgent: "general_agent",
        intentKeywords: ["location", "place"],
        contextFactors: [],
      };

      expect(response.targetAgent).toBe("location_agent");
      expect(response.confidence).toBe(4);
    });

    test("Unit -> handoffRoutingResponseSchema accepts empty string for fallbackAgent", () => {
      const response: HandoffRoutingResponse = {
        targetAgent: "location_agent",
        confidence: 4,
        reasoning: "User is asking about location details",
        fallbackAgent: "",
        intentKeywords: ["location"],
        contextFactors: [],
      };

      const result = handoffRoutingResponseSchema.safeParse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fallbackAgent).toBe("");
        expect(result.data.contextFactors).toEqual([]);
      }
    });
  });
});
