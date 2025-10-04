import { test, expect, beforeEach, describe } from "bun:test";
import { analyzeConversationContext } from "./analyzeConversationContext";
import type {
  ConversationAnalysis,
  AnalysisMessage,
} from "./analyzeConversationContext";

describe("analyzeConversationContext", () => {
  // Default mock data - reusable across tests
  const createMessage = (
    id: string,
    content: string,
    role: "user" | "assistant" | "system",
    createdAt: string,
    routingMetadata?: AnalysisMessage["routingMetadata"]
  ): AnalysisMessage => ({
    id,
    content,
    role,
    createdAt,
    routingMetadata,
  });

  beforeEach(() => {
    // No mocks to clear for this tool
  });

  test("Unit -> analyzeConversationContext returns empty analysis for no messages", async () => {
    const input = { messageCount: 5 };

    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.analysisType).toBe("conversation_context");
    expect(parsed.messageCount).toBe(0);
    expect(parsed.topicShifts).toEqual([]);
    expect(parsed.dominantTopics).toEqual([]);
    expect(parsed.topicStability).toBe(1.0);
    expect(parsed.agentPerformance).toEqual({});
    expect(parsed.patterns).toEqual([]);
    expect(parsed.continuityFactors).toEqual([]);
    expect(parsed.recommendations).toEqual([
      "No conversation history available for analysis",
    ]);
  });

  test("Unit -> analyzeConversationContext detects topic shifts", async () => {
    const messages = [
      createMessage(
        "1",
        "Create a character for me",
        "user",
        "2024-01-01T10:00:00Z"
      ),
      createMessage(
        "2",
        "I'll help you create a character",
        "assistant",
        "2024-01-01T10:01:00Z"
      ),
      createMessage(
        "3",
        "How do I calculate damage in combat?",
        "user",
        "2024-01-01T10:02:00Z"
      ),
      createMessage(
        "4",
        "Combat damage is calculated...",
        "assistant",
        "2024-01-01T10:03:00Z"
      ),
    ];

    const input = { messageCount: 4, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.topicShifts).toHaveLength(1);
    expect(parsed.topicShifts[0].from).toBe("character_creation");
    expect(parsed.topicShifts[0].to).toBe("combat_rules");
    expect(parsed.topicShifts[0].messageIndex).toBe(2);
  });

  test("Unit -> analyzeConversationContext identifies dominant topics", async () => {
    const messages = [
      createMessage("1", "Create a character", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Set character stats", "user", "2024-01-01T10:01:00Z"),
      createMessage(
        "3",
        "Choose character background",
        "user",
        "2024-01-01T10:02:00Z"
      ),
      createMessage(
        "4",
        "Calculate some numbers",
        "user",
        "2024-01-01T10:03:00Z"
      ),
    ];

    const input = { messageCount: 4, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.dominantTopics).toContain("character_creation");
    expect(parsed.dominantTopics).toContain("calculations");
  });

  test("Unit -> analyzeConversationContext calculates topic stability", async () => {
    const stableMessages = [
      createMessage("1", "Create a character", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Set character stats", "user", "2024-01-01T10:01:00Z"),
      createMessage(
        "3",
        "Choose character background",
        "user",
        "2024-01-01T10:02:00Z"
      ),
    ];

    const unstableMessages = [
      createMessage("1", "Create a character", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Calculate damage", "user", "2024-01-01T10:01:00Z"),
      createMessage("3", "Cast a spell", "user", "2024-01-01T10:02:00Z"),
      createMessage(
        "4",
        "Need technical support",
        "user",
        "2024-01-01T10:03:00Z"
      ),
    ];

    const stableResult = await analyzeConversationContext.func({
      messageCount: 3,
      messages: stableMessages,
    });
    const stableParsed = JSON.parse(stableResult) as ConversationAnalysis;

    const unstableResult = await analyzeConversationContext.func({
      messageCount: 4,
      messages: unstableMessages,
    });
    const unstableParsed = JSON.parse(unstableResult) as ConversationAnalysis;

    expect(stableParsed.topicStability).toBeGreaterThan(
      unstableParsed.topicStability
    );
  });

  test("Unit -> analyzeConversationContext analyzes agent performance", async () => {
    const messages = [
      createMessage("1", "Create a character", "user", "2024-01-01T10:00:00Z"),
      createMessage(
        "2",
        "Created character",
        "assistant",
        "2024-01-01T10:01:00Z",
        {
          decision: {
            targetAgent: "Character Generator",
            confidence: 4.5,
            reasoning: "Character creation request",
            intentKeywords: ["character", "create"],
          },
          success: true,
          executionTime: 100,
          fallbackUsed: false,
        }
      ),
      createMessage(
        "3",
        "Thank you, that's perfect!",
        "user",
        "2024-01-01T10:02:00Z"
      ),
      createMessage("4", "Calculate 2+2", "user", "2024-01-01T10:03:00Z"),
      createMessage(
        "5",
        "The answer is 4",
        "assistant",
        "2024-01-01T10:04:00Z",
        {
          decision: {
            targetAgent: "Cheapest",
            confidence: 3.0,
            reasoning: "Simple calculation request",
            intentKeywords: ["calculate", "math"],
          },
          success: true,
          executionTime: 50,
          fallbackUsed: false,
        }
      ),
    ];

    const input = { messageCount: 5, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.agentPerformance["Character Generator"]).toBeDefined();
    expect(parsed.agentPerformance["Character Generator"].successRate).toBe(
      1.0
    );
    expect(
      parsed.agentPerformance["Character Generator"].userSatisfaction
    ).toBe("positive");
    expect(parsed.agentPerformance["Cheapest"]).toBeDefined();
  });

  test("Unit -> analyzeConversationContext detects escalating complexity pattern", async () => {
    const messages = [
      createMessage("1", "Hi", "user", "2024-01-01T10:00:00Z"),
      createMessage(
        "2",
        "I need to implement a complex optimization algorithm",
        "user",
        "2024-01-01T10:01:00Z"
      ),
      createMessage(
        "3",
        "Please help me debug and analyze this sophisticated configuration system for enterprise deployment",
        "user",
        "2024-01-01T10:02:00Z"
      ),
    ];

    const input = { messageCount: 3, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    const escalatingPattern = parsed.patterns.find(
      (p) => p.type === "escalating_complexity"
    );
    expect(escalatingPattern).toBeDefined();
    expect(escalatingPattern?.recommendation).toBe("route_to_specialist");
  });

  test("Unit -> analyzeConversationContext detects repeated failures pattern", async () => {
    const messages = [
      createMessage("1", "Test request", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Response", "assistant", "2024-01-01T10:01:00Z", {
        decision: {
          targetAgent: "Cheapest",
          confidence: 2.0,
          reasoning: "General request",
          intentKeywords: ["test"],
        },
        success: false,
        executionTime: 100,
        fallbackUsed: false,
      }),
      createMessage("3", "Another request", "user", "2024-01-01T10:02:00Z"),
      createMessage("4", "Response", "assistant", "2024-01-01T10:03:00Z", {
        decision: {
          targetAgent: "Character Generator",
          confidence: 1.5,
          reasoning: "Another attempt",
          intentKeywords: ["request"],
        },
        success: false,
        executionTime: 100,
        fallbackUsed: false,
      }),
    ];

    const input = { messageCount: 4, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    const failurePattern = parsed.patterns.find(
      (p) => p.type === "repeated_failures"
    );
    expect(failurePattern).toBeDefined();
    expect(failurePattern?.failureCount).toBe(2);
    expect(failurePattern?.recommendation).toBe("try_different_agent");
  });

  test("Unit -> analyzeConversationContext detects workflow continuation pattern", async () => {
    const messages = [
      createMessage("1", "Create a character", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Set character stats", "user", "2024-01-01T10:01:00Z"),
      createMessage(
        "3",
        "Choose character race",
        "user",
        "2024-01-01T10:02:00Z"
      ),
      createMessage(
        "4",
        "Select character class",
        "user",
        "2024-01-01T10:03:00Z"
      ),
    ];

    const input = { messageCount: 4, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    const workflowPattern = parsed.patterns.find(
      (p) => p.type === "session_flow"
    );
    expect(workflowPattern).toBeDefined();
    expect(workflowPattern?.currentStep).toBe("character_creation");
    expect(workflowPattern?.recommendation).toBe("maintain_current_agent");
  });

  test("Unit -> analyzeConversationContext detects topic drift pattern", async () => {
    const messages = [
      createMessage("1", "Create character", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Calculate damage", "user", "2024-01-01T10:01:00Z"),
      createMessage("3", "Cast spell", "user", "2024-01-01T10:02:00Z"),
      createMessage("4", "Need help", "user", "2024-01-01T10:03:00Z"),
      createMessage("5", "Adventure story", "user", "2024-01-01T10:04:00Z"),
    ];

    const input = { messageCount: 5, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    const driftPattern = parsed.patterns.find((p) => p.type === "topic_drift");
    expect(driftPattern).toBeDefined();
    expect(driftPattern?.recommendation).toBe("try_different_agent");
  });

  test("Unit -> analyzeConversationContext assesses active workflow continuity", async () => {
    const messages = [
      createMessage("1", "Create character", "user", "2024-01-01T10:00:00Z"),
      createMessage("2", "Set character stats", "user", "2024-01-01T10:01:00Z"),
      createMessage("3", "Choose background", "user", "2024-01-01T10:02:00Z"),
    ];

    const input = { messageCount: 3, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    const workflowFactor = parsed.continuityFactors.find(
      (f) => f.type === "active_workflow"
    );
    expect(workflowFactor).toBeDefined();
    expect(workflowFactor?.workflow).toBe("character_creation");
    expect(workflowFactor?.completionPercentage).toBeGreaterThan(0);
  });

  test("Unit -> analyzeConversationContext assesses knowledge buildup", async () => {
    const messages = [
      createMessage("1", "Question", "user", "2024-01-01T10:00:00Z"),
      createMessage(
        "2",
        "This is a very detailed and comprehensive response with extensive context and information that builds understanding and demonstrates significant knowledge depth. This response contains many words and provides thorough explanations that would indicate high contextual value in the conversation. The assistant is clearly building substantial context through these detailed responses that show deep engagement with the user's needs and requirements.",
        "assistant",
        "2024-01-01T10:01:00Z"
      ),
      createMessage("3", "Another question", "user", "2024-01-01T10:02:00Z"),
      createMessage(
        "4",
        "Another extremely comprehensive response that continues building on the previous context with extensive detail and thorough explanations. This response also contains substantial content that demonstrates the assistant's commitment to providing rich, contextual information that builds upon the conversation history.",
        "assistant",
        "2024-01-01T10:03:00Z"
      ),
      createMessage("5", "Follow up", "user", "2024-01-01T10:04:00Z"),
      createMessage(
        "6",
        "Yet another detailed response maintaining continuity with substantial context and comprehensive information that further builds the knowledge base established in previous interactions.",
        "assistant",
        "2024-01-01T10:05:00Z"
      ),
    ];

    const input = { messageCount: 6, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    const knowledgeFactor = parsed.continuityFactors.find(
      (f) => f.type === "knowledge_buildup"
    );
    expect(knowledgeFactor).toBeDefined();
    expect(knowledgeFactor?.contextValue).toBeOneOf(["medium", "high"]);
  });

  test("Unit -> analyzeConversationContext generates appropriate recommendations", async () => {
    const messages = [
      createMessage("1", "Create character", "user", "2024-01-01T10:00:00Z"),
      createMessage(
        "2",
        "Character created",
        "assistant",
        "2024-01-01T10:01:00Z"
      ),
      createMessage("3", "Set character stats", "user", "2024-01-01T10:02:00Z"),
    ];

    const input = { messageCount: 3, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.recommendations).toBeInstanceOf(Array);
    expect(parsed.recommendations.length).toBeGreaterThan(0);
    expect(parsed.recommendations[0]).toContain("character_creation");
  });

  test("Unit -> analyzeConversationContext validates input parameters with Zod", async () => {
    const input = { messageCount: 0 };

    try {
      await analyzeConversationContext.func(input);
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect(String(error)).toContain("Too small");
    }
  });

  test("Unit -> analyzeConversationContext handles minimum messageCount", async () => {
    const messages = [
      createMessage("1", "Hello", "user", "2024-01-01T10:00:00Z"),
    ];

    const input = { messageCount: 1, messages };
    const result = await analyzeConversationContext.func(input);
    const parsed = JSON.parse(result) as ConversationAnalysis;

    expect(parsed.messageCount).toBe(1);
    expect(parsed.analysisType).toBe("conversation_context");
  });
});
