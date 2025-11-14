import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { BaseMessage } from "@langchain/core/messages";
import type { GenerateMessagePayload } from "../../generated/graphql";
import type { AIAgentDefinition } from "./types";

describe("generateMessageWithRouter", () => {
  let mockFindUnique: ReturnType<typeof mock>;
  let mockUpdate: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findUnique: ReturnType<typeof mock>;
      update: ReturnType<typeof mock>;
    };
  };
  let mockRunRouterWorkflow: ReturnType<typeof mock>;
  let mockSaveMessage: ReturnType<typeof mock>;
  let mockTranslateMessage: ReturnType<typeof mock>;
  let generateMessageWithRouter: (params: {
    threadId: string;
    agent: AIAgentDefinition;
    messageHistory: BaseMessage[];
    runId: string;
  }) => AsyncGenerator<GenerateMessagePayload>;

  const defaultThread = {
    userId: "507f1f77bcf86cd799439011",
    selectedAgent: "MainRouter",
    messages: [
      {
        role: "user",
        content: "Create a wizard character",
        createdAt: new Date(),
      },
    ],
  };

  const defaultAgent = {
    name: "MainRouter",
    systemMessage: "Test router",
    model: { modelName: "gpt-4.1-nano" },
    useHistory: true,
    availableTools: [],
    availableSubAgents: [{ name: "SubAgent" }],
  };

  const defaultMessageHistory = [
    {
      role: "system" as const,
      content: "Test router",
    },
    {
      role: "user" as const,
      content: "Create a wizard character",
    },
  ];

  const defaultSavedMessage = {
    id: "507f1f77bcf86cd799439012",
    content: "Created a level 1 wizard character named Merlin",
    role: "assistant",
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mock.restore();

    // Create mocks
    mockFindUnique = mock();
    mockUpdate = mock();
    mockDBClient = {
      thread: {
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
    };
    mockRunRouterWorkflow = mock();
    mockSaveMessage = mock();
    mockTranslateMessage = mock();

    // Mock modules
    mock.module("../MongoDB", () => ({
      DBClient: mockDBClient,
      saveMessage: mockSaveMessage,
    }));

    mock.module("./Workflows/routerWorkflow", () => ({
      runRouterWorkflow: mockRunRouterWorkflow,
    }));

    mock.module("../../modules/utils", () => ({
      TranslateMessage: mockTranslateMessage,
    }));

    // Dynamic import
    const module = await import("./generateMessageWithRouter");
    generateMessageWithRouter = module.generateMessageWithRouter;

    // Configure mocks
    mockFindUnique.mockResolvedValue(defaultThread);
    mockSaveMessage.mockResolvedValue(defaultSavedMessage);
    mockTranslateMessage.mockReturnValue(defaultSavedMessage);
    mockRunRouterWorkflow.mockResolvedValue({
      routingDecision: {
        targetAgent: "Character Generator",
        confidence: 4.5,
        reasoning: "Character creation request",
        fallbackAgent: "Cheapest",
        intentKeywords: ["character", "wizard"],
        contextFactors: [],
        routedAt: new Date(),
        routingVersion: "1.0",
      },
      currentResponse: "Created a level 1 wizard character named Merlin",
      runId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      routingMetadata: {
        executionTime: 150,
        success: true,
        fallbackUsed: false,
      },
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> generateMessageWithRouter handles character creation requests", async () => {
    const generator = generateMessageWithRouter({
      threadId: "507f1f77bcf86cd799439013",
      agent: defaultAgent as unknown as AIAgentDefinition,
      messageHistory: defaultMessageHistory as unknown as BaseMessage[],
      runId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    });
    const results = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content?.includes("Analyzing request"))).toBe(
      true
    );
    expect(results.some((r) => r.content?.includes("Routing to"))).toBe(true);

    const finalResult = results[results.length - 1];
    expect(finalResult.responseType).toBe("Final");
    expect(finalResult.content).toBe(
      "Created a level 1 wizard character named Merlin"
    );
  });

  test("Unit -> generateMessageWithRouter yields routing progress messages", async () => {
    const generator = generateMessageWithRouter({
      threadId: "507f1f77bcf86cd799439013",
      agent: defaultAgent as unknown as AIAgentDefinition,
      messageHistory: defaultMessageHistory as unknown as BaseMessage[],
      runId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    });

    const results = [];
    for await (const result of generator) {
      results.push(result);
    }

    // Verify routing progress messages are yielded
    expect(results.some((r) => r.content?.includes("Analyzing request"))).toBe(
      true
    );
    expect(results.some((r) => r.content?.includes("Routing to"))).toBe(true);
    expect(results[results.length - 1].responseType).toBe("Final");
  });

  test("Unit -> generateMessageWithRouter stores routing metadata with message", async () => {
    const generator = generateMessageWithRouter({
      threadId: "507f1f77bcf86cd799439013",
      agent: defaultAgent as unknown as AIAgentDefinition,
      messageHistory: defaultMessageHistory as unknown as BaseMessage[],
      runId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    });

    // Consume the generator
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _result of generator) {
      // Process results
    }

    // Verify routing metadata is stored with the message
    expect(mockSaveMessage).toHaveBeenCalledWith({
      threadId: "507f1f77bcf86cd799439013",
      content: "Created a level 1 wizard character named Merlin",
      role: "assistant",

      workspace: [
        {
          content: expect.stringContaining("Routed to:") as string,
          elapsedTime: expect.any(Number) as number,
          messageType: "routing",
          timestamp: expect.any(Date) as Date,
        },
      ],
      runId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",

      routingMetadata: {
        executionTime: 0,
        fallbackUsed: false,
        success: true,
      },
    });
  });
});
