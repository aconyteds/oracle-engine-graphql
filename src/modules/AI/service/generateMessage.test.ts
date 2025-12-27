import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { Message, Thread } from "../../../data/MongoDB";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import type { GenerateMessageProps } from "./generateMessage";

type MockThread = Thread & {
  messages: Message[];
};

describe("Unit -> generateMessage", () => {
  // Mock variables
  let mockFindFirst: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findFirst: ReturnType<typeof mock>;
    };
  };
  let mockGenerateMessageWithAgent: ReturnType<typeof mock>;
  let mockRandomUUID: ReturnType<typeof mock>;
  let mockGetCampaign: ReturnType<typeof mock>;
  let generateMessage: (
    input: GenerateMessageProps
  ) => AsyncGenerator<GenerateMessagePayload>;

  const defaultInput: GenerateMessageProps = {
    threadId: "thread-id",
    userId: "user-id",
  };

  // Default mock data
  const defaultThread: MockThread = {
    id: "thread-id",
    title: "Test Thread",
    userId: "user-id",
    campaignId: "campaign-id",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultCampaign = {
    id: "campaign-id",
    name: "Test Campaign",
    setting: "Fantasy World",
    tone: "Epic Adventure",
    ruleset: "D&D 5e",
    ownerId: "user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultRouter = {
    name: "router-agent",
    model: "gpt-4",
    routerType: "router" as const,
    systemMessage: "You are a router agent",
    availableTools: [],
    availableSubAgents: [{ name: "sub-agent" }],
  };

  const defaultMessage: Message = {
    id: "msg-1",
    role: "user",
    content: "Hello",
    tokenCount: 10,
    workspace: [],
    threadId: "thread-id",
    runId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    routingMetadata: null,
  };

  const defaultWorkflowResults = [
    {
      responseType: "Final" as const,
      content: "Generated response",
    },
  ];

  beforeEach(async () => {
    // Restore all mocks first
    mock.restore();

    // Create mock functions
    mockFindFirst = mock();
    mockDBClient = {
      thread: {
        findFirst: mockFindFirst,
      },
    };
    mockGenerateMessageWithAgent = mock();
    mockRandomUUID = mock();
    mockGetCampaign = mock();

    // Mock modules
    const prismaTypes = await import("@prisma/client");
    void mock.module("../../../data/MongoDB/client", () => ({
      ...prismaTypes,
      DBClient: mockDBClient,
    }));

    // Mock the specific generateMessageWithAgent module
    void mock.module("../../../data/AI/generateMessageWithAgent", () => ({
      generateMessageWithAgent: mockGenerateMessageWithAgent,
    }));

    // Mock the specific defaultRouter module
    void mock.module("../../../data/AI/Agents/defaultRouter", () => ({
      defaultRouter: defaultRouter,
    }));

    void mock.module("crypto", () => ({
      randomUUID: mockRandomUUID,
    }));

    void mock.module("../../Campaign/service/getCampaign", () => ({
      getCampaign: mockGetCampaign,
    }));

    // Dynamic import
    const module = await import("./generateMessage");
    generateMessage = module.generateMessage;

    // Set up default mock behavior
    mockFindFirst.mockResolvedValue(defaultThread);
    mockGetCampaign.mockResolvedValue(defaultCampaign);

    mockGenerateMessageWithAgent.mockImplementation(async function* () {
      for (const result of defaultWorkflowResults) {
        await Promise.resolve();
        yield result;
      }
    });

    mockRandomUUID.mockReturnValue("test-run-id");
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> generateMessage throws error when thread not found", () => {
    mockFindFirst.mockResolvedValue(null);

    const generator = generateMessage({
      ...defaultInput,
      threadId: "non-existent-thread-id",
    });

    expect(generator.next()).rejects.toThrow("Thread not found");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "non-existent-thread-id", userId: "user-id" },
      select: {
        campaignId: true,
        userId: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  });

  test("Unit -> generateMessage calls generateMessageWithAgent with correct params", async () => {
    const mockMessages: Message[] = [{ ...defaultMessage, content: "Hello" }];

    const mockThread: MockThread = {
      ...defaultThread,
      messages: mockMessages,
    };

    mockFindFirst.mockResolvedValue(mockThread);

    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      responseType: "Final",
      content: "Generated response",
    });

    expect(mockGenerateMessageWithAgent).toHaveBeenCalledWith({
      threadId: "thread-id",
      runId: "test-run-id",
      agent: defaultRouter,
      messageHistory: [new HumanMessage("Hello")],
      requestContext: {
        userId: "user-id",
        campaignId: "campaign-id",
        threadId: "thread-id",
        runId: "test-run-id",
        campaignMetadata: {
          name: "Test Campaign",
          setting: "Fantasy World",
          tone: "Epic Adventure",
          ruleset: "D&D 5e",
        },
        allowEdits: true,
      },
    });
  });

  test("Unit -> generateMessage generates unique runId for each call", async () => {
    mockRandomUUID
      .mockReturnValueOnce("run-id-1")
      .mockReturnValueOnce("run-id-2");

    // First call
    const generator1 = generateMessage(defaultInput);
    await generator1.next();

    // Second call
    const generator2 = generateMessage(defaultInput);
    await generator2.next();

    expect(mockGenerateMessageWithAgent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ runId: "run-id-1" })
    );
    expect(mockGenerateMessageWithAgent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ runId: "run-id-2" })
    );
  });

  test("Unit -> generateMessage handles messages with mixed user and assistant roles", async () => {
    const mockMessages: Message[] = [
      { ...defaultMessage, role: "user", content: "Hello" },
      { ...defaultMessage, role: "assistant", content: "Hi there!" },
      { ...defaultMessage, role: "user", content: "How are you?" },
    ];

    const mockThread: MockThread = {
      ...defaultThread,
      messages: mockMessages,
    };

    mockFindFirst.mockResolvedValue(mockThread);

    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);

    expect(mockGenerateMessageWithAgent).toHaveBeenCalledWith({
      threadId: "thread-id",
      runId: "test-run-id",
      agent: defaultRouter,
      messageHistory: [
        new HumanMessage("Hello"),
        new AIMessage("Hi there!"),
        new HumanMessage("How are you?"),
      ],
      requestContext: {
        userId: "user-id",
        campaignId: "campaign-id",
        threadId: "thread-id",
        runId: "test-run-id",
        campaignMetadata: {
          name: "Test Campaign",
          setting: "Fantasy World",
          tone: "Epic Adventure",
          ruleset: "D&D 5e",
        },
        allowEdits: true,
      },
    });
  });

  test("Unit -> generateMessage handles empty message history", async () => {
    const mockThread: MockThread = {
      ...defaultThread,
      messages: [],
    };

    mockFindFirst.mockResolvedValue(mockThread);

    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);

    expect(mockGenerateMessageWithAgent).toHaveBeenCalledWith({
      threadId: "thread-id",
      runId: "test-run-id",
      agent: defaultRouter,
      messageHistory: [],
      requestContext: {
        userId: "user-id",
        campaignId: "campaign-id",
        threadId: "thread-id",
        runId: "test-run-id",
        campaignMetadata: {
          name: "Test Campaign",
          setting: "Fantasy World",
          tone: "Epic Adventure",
          ruleset: "D&D 5e",
        },
        allowEdits: true,
      },
    });
  });

  test("Unit -> generateMessage ignores messages with roles other than user or assistant", async () => {
    const systemRole = "system" as const;
    const mockMessages: Message[] = [
      { ...defaultMessage, role: "user", content: "Hello" },
      {
        ...defaultMessage,
        role: systemRole,
        content: "System message",
      } as Message,
      { ...defaultMessage, role: "assistant", content: "Hi!" },
    ];

    const mockThread: MockThread = {
      ...defaultThread,
      messages: mockMessages,
    };

    mockFindFirst.mockResolvedValue(mockThread);

    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);

    // Should only include user and assistant messages
    expect(mockGenerateMessageWithAgent).toHaveBeenCalledWith({
      threadId: "thread-id",
      runId: "test-run-id",
      agent: defaultRouter,
      messageHistory: [new HumanMessage("Hello"), new AIMessage("Hi!")],
      requestContext: {
        userId: "user-id",
        campaignId: "campaign-id",
        threadId: "thread-id",
        runId: "test-run-id",
        campaignMetadata: {
          name: "Test Campaign",
          setting: "Fantasy World",
          tone: "Epic Adventure",
          ruleset: "D&D 5e",
        },
        allowEdits: true,
      },
    });
  });

  test("Unit -> generateMessage fetches campaign metadata", async () => {
    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(mockGetCampaign).toHaveBeenCalledWith("campaign-id");
  });

  test("Unit -> generateMessage handles campaign fetch error gracefully for non-security errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleErrorLocal = mock();
    console.error = mockConsoleErrorLocal;

    try {
      mockGetCampaign.mockRejectedValue(
        new Error("Database connection failed")
      );

      const generator = generateMessage(defaultInput);
      const results: GenerateMessagePayload[] = [];

      for await (const result of generator) {
        results.push(result);
      }

      // Should still work, just without campaign metadata
      expect(results).toHaveLength(1);
      expect(mockConsoleErrorLocal).toHaveBeenCalledWith(
        "Failed to fetch campaign metadata:",
        expect.any(Error)
      );

      // Should pass undefined campaignMetadata to generateMessageWithAgent
      const callArgs = mockGenerateMessageWithAgent.mock.calls[0][0];
      expect(callArgs.requestContext.campaignMetadata).toBeUndefined();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> generateMessage throws error when campaign not found", async () => {
    mockGetCampaign.mockResolvedValue(null);

    const generator = generateMessage(defaultInput);

    expect(generator.next()).rejects.toThrow("Campaign not found");
  });

  test("Unit -> generateMessage streams all payloads from generateMessageWithAgent", async () => {
    const multipleWorkflowResults = [
      {
        responseType: "Intermediate" as const,
        content: "Thinking...",
      },
      {
        responseType: "Intermediate" as const,
        content: "Processing...",
      },
      {
        responseType: "Final" as const,
        content: "Final response",
      },
    ];

    mockGenerateMessageWithAgent.mockImplementation(async function* () {
      for (const result of multipleWorkflowResults) {
        await Promise.resolve();
        yield result;
      }
    });

    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      responseType: "Intermediate",
      content: "Thinking...",
    });
    expect(results[1]).toEqual({
      responseType: "Intermediate",
      content: "Processing...",
    });
    expect(results[2]).toEqual({
      responseType: "Final",
      content: "Final response",
    });
  });

  // Security tests
  test("Unit -> generateMessage throws error when thread belongs to different user", async () => {
    const unauthorizedThread: MockThread = {
      ...defaultThread,
      userId: "different-user-id",
    };

    mockFindFirst.mockResolvedValue(unauthorizedThread);

    const generator = generateMessage(defaultInput);

    expect(generator.next()).rejects.toThrow("Unauthorized access to thread");
  });

  test("Unit -> generateMessage throws error when campaign belongs to different user", async () => {
    const unauthorizedCampaign = {
      ...defaultCampaign,
      ownerId: "different-user-id",
    };

    mockGetCampaign.mockResolvedValue(unauthorizedCampaign);

    const generator = generateMessage(defaultInput);

    expect(generator.next()).rejects.toThrow("Unauthorized access to campaign");
  });

  test("Unit -> generateMessage uses findFirst with userId in query for defense-in-depth", async () => {
    const generator = generateMessage(defaultInput);
    await generator.next();

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        id: "thread-id",
        userId: "user-id",
      },
      select: {
        campaignId: true,
        userId: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  });

  test("Unit -> generateMessage verifies campaign ownership after fetch", async () => {
    const generator = generateMessage(defaultInput);
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(mockGetCampaign).toHaveBeenCalledWith("campaign-id");
    expect(results).toHaveLength(1);
  });
});
