import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { BaseMessage } from "@langchain/core/messages";
import type { Message } from "../MongoDB";
import type { AIAgentDefinition } from "./types";
import { RouterType } from "./types";

describe("truncateMessageHistory", () => {
  let mockCalculateTokenCount: ReturnType<typeof mock>;
  let truncateMessageHistory: (params: {
    messageList: Message[];
    agent: AIAgentDefinition;
    truncationStrategy?: "latest" | "alternate";
    maxContextPercentage?: number;
  }) => BaseMessage[];

  // Default mock data - reusable across tests
  const defaultAgent: AIAgentDefinition = {
    name: "test-agent",
    description: "Test agent",
    model: {
      modelName: "gpt-4",
      contextWindow: 8000,
      modelProvider: "OpenAI",
    },
    systemMessage: "You are a helpful assistant.",
    availableTools: [],
    specialization: "general",
    routerType: RouterType.Simple,
  };

  const createMessage = (
    content: string,
    role: "user" | "assistant",
    createdAt: Date,
    tokenCount?: number
  ): Message => ({
    id: `msg-${Math.random()}`,
    content,
    role,
    createdAt,
    updatedAt: createdAt,
    tokenCount: tokenCount || 0,
    threadId: "thread-1",
    workspace: [],
    runId: null,
    routingMetadata: null,
  });

  beforeEach(async () => {
    mock.restore();

    mockCalculateTokenCount = mock();

    mock.module("./calculateTokenCount", () => ({
      calculateTokenCount: mockCalculateTokenCount,
    }));

    const module = await import("./truncateMessageHistory");
    truncateMessageHistory = module.truncateMessageHistory;

    mockCalculateTokenCount.mockClear();
    // Default token count calculation
    mockCalculateTokenCount.mockImplementation(
      (content: string) => content.length
    );
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> truncateMessageHistory returns empty array for empty message list", () => {
    const result = truncateMessageHistory({
      messageList: [],
      agent: defaultAgent,
    });

    expect(result).toEqual([]);
  });

  test("Unit -> truncateMessageHistory handles single message pair within limit", () => {
    const messages: Message[] = [
      createMessage("Hello", "user", new Date("2024-01-01T10:00:00Z"), 50),
      createMessage(
        "Hi there!",
        "assistant",
        new Date("2024-01-01T10:01:00Z"),
        50
      ),
    ];

    const result = truncateMessageHistory({
      messageList: messages,
      agent: defaultAgent,
      maxContextPercentage: 0.5, // 4000 tokens available
    });

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Hello");
    expect(result[1].content).toBe("Hi there!");
  });

  test("Unit -> truncateMessageHistory respects token limits with latest strategy", () => {
    const messages: Message[] = [
      createMessage(
        "First message",
        "user",
        new Date("2024-01-01T09:00:00Z"),
        2000
      ),
      createMessage(
        "First response",
        "assistant",
        new Date("2024-01-01T09:01:00Z"),
        2000
      ),
      createMessage(
        "Second message",
        "user",
        new Date("2024-01-01T10:00:00Z"),
        1000
      ),
      createMessage(
        "Second response",
        "assistant",
        new Date("2024-01-01T10:01:00Z"),
        1000
      ),
      createMessage(
        "Third message",
        "user",
        new Date("2024-01-01T11:00:00Z"),
        500
      ),
      createMessage(
        "Third response",
        "assistant",
        new Date("2024-01-01T11:01:00Z"),
        500
      ),
    ];

    const result = truncateMessageHistory({
      messageList: messages,
      agent: defaultAgent,
      truncationStrategy: "latest",
      maxContextPercentage: 0.5, // 4000 tokens available, system message takes ~25
    });

    // Should include latest messages that fit within token limit
    // Third pair (1000 tokens) + Second pair (2000 tokens) = 3000 + system = ~3025 < 4000
    expect(result).toHaveLength(4);
    // Messages should be ordered chronologically (oldest first)
    expect(result[0].content).toBe("Second message");
    expect(result[1].content).toBe("Second response");
    expect(result[2].content).toBe("Third message");
    expect(result[3].content).toBe("Third response");
  });

  test("Unit -> truncateMessageHistory uses alternate strategy correctly", () => {
    const messages: Message[] = [
      createMessage("Oldest", "user", new Date("2024-01-01T09:00:00Z"), 500),
      createMessage(
        "Oldest response",
        "assistant",
        new Date("2024-01-01T09:01:00Z"),
        500
      ),
      createMessage("Middle", "user", new Date("2024-01-01T10:00:00Z"), 500),
      createMessage(
        "Middle response",
        "assistant",
        new Date("2024-01-01T10:01:00Z"),
        500
      ),
      createMessage("Newest", "user", new Date("2024-01-01T11:00:00Z"), 500),
      createMessage(
        "Newest response",
        "assistant",
        new Date("2024-01-01T11:01:00Z"),
        500
      ),
    ];

    const result = truncateMessageHistory({
      messageList: messages,
      agent: defaultAgent,
      truncationStrategy: "alternate",
      maxContextPercentage: 0.5, // 4000 tokens available
    });

    // Should alternate between newest and oldest
    // First: newest pair (1000), then oldest pair (1000), then middle pair (1000) = 3000 + system < 4000
    expect(result).toHaveLength(6);
    // Should be sorted chronologically in final result
    expect(result[0].content).toBe("Oldest");
    expect(result[1].content).toBe("Oldest response");
    expect(result[2].content).toBe("Middle");
    expect(result[3].content).toBe("Middle response");
    expect(result[4].content).toBe("Newest");
    expect(result[5].content).toBe("Newest response");
  });

  test("Unit -> truncateMessageHistory stops when token limit is exceeded", () => {
    const smallAgent: AIAgentDefinition = {
      ...defaultAgent,
      systemMessage: "", // No system message
    };

    const messages: Message[] = [
      createMessage("Small", "user", new Date("2024-01-01T09:00:00Z"), 100),
      createMessage(
        "Small response",
        "assistant",
        new Date("2024-01-01T09:01:00Z"),
        100
      ),
      createMessage("Large", "user", new Date("2024-01-01T10:00:00Z"), 3500),
      createMessage(
        "Large response",
        "assistant",
        new Date("2024-01-01T10:01:00Z"),
        3500
      ),
    ];

    const result = truncateMessageHistory({
      messageList: messages,
      agent: smallAgent,
      truncationStrategy: "latest",
      maxContextPercentage: 0.5, // 4000 tokens available
    });

    // With latest strategy, it tries large pair first (7000 tokens) - exceeds 4000 limit
    // Then tries small pair (200 tokens) - fits within 4000
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Small");
    expect(result[1].content).toBe("Small response");
  });

  test("Unit -> truncateMessageHistory handles missing tokenCount by calculating", () => {
    const messages: Message[] = [
      createMessage("Hello", "user", new Date("2024-01-01T10:00:00Z")), // No tokenCount
      createMessage("Hi!", "assistant", new Date("2024-01-01T10:01:00Z")), // No tokenCount
    ];

    const result = truncateMessageHistory({
      messageList: messages,
      agent: defaultAgent,
    });

    expect(mockCalculateTokenCount).toHaveBeenCalledWith("Hello");
    expect(mockCalculateTokenCount).toHaveBeenCalledWith("Hi!");
    expect(result).toHaveLength(2);
  });

  test("Unit -> truncateMessageHistory handles incomplete message pairs", () => {
    const messages: Message[] = [
      createMessage("User only", "user", new Date("2024-01-01T10:00:00Z"), 100),
      // No assistant response for this user message
      createMessage(
        "Another user",
        "user",
        new Date("2024-01-01T11:00:00Z"),
        100
      ),
      createMessage(
        "Assistant response",
        "assistant",
        new Date("2024-01-01T11:01:00Z"),
        100
      ),
    ];

    const result = truncateMessageHistory({
      messageList: messages,
      agent: defaultAgent,
      truncationStrategy: "latest",
    });

    // Should handle incomplete pairs gracefully
    expect(result).toHaveLength(3);
    // Should be sorted chronologically
    expect(result[0].content).toBe("User only");
    expect(result[1].content).toBe("Another user");
    expect(result[2].content).toBe("Assistant response");
  });

  test("Unit -> truncateMessageHistory accounts for system message tokens", () => {
    const largeSystemAgent: AIAgentDefinition = {
      ...defaultAgent,
      systemMessage:
        "This is a very long system message that takes up significant tokens",
    };

    const messages: Message[] = [
      createMessage("Test", "user", new Date("2024-01-01T10:00:00Z"), 3000),
      createMessage(
        "Response",
        "assistant",
        new Date("2024-01-01T10:01:00Z"),
        3000
      ),
    ];

    // Mock system message to return high token count
    mockCalculateTokenCount.mockImplementation((content: string) => {
      if (content.includes("very long system message")) return 2000;
      return content.length;
    });

    const result = truncateMessageHistory({
      messageList: messages,
      agent: largeSystemAgent,
      maxContextPercentage: 0.75, // 6000 tokens available
    });

    // System (2000) + Messages (6000) = 8000 > 6000 limit, so no messages should be included
    expect(result).toHaveLength(0);
  });
});
