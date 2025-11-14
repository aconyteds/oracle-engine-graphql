import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Message } from "../../../data/MongoDB";
import type { GenerateMessagePayload } from "../../../generated/graphql";

// Mock Thread type with messages property
interface MockThread {
  id: string;
  title: string;
  userId: string;
  selectedAgent: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

describe("Unit -> generateMessage", () => {
  // Mock variables
  let mockFindUnique: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let mockServerError: ReturnType<typeof mock>;
  let mockTruncateMessageHistory: ReturnType<typeof mock>;
  let mockGetAgentByName: ReturnType<typeof mock>;
  let mockGetModelDefinition: ReturnType<typeof mock>;
  let mockGenerateMessageWithRouter: ReturnType<typeof mock>;
  let mockGenerateMessageWithStandardWorkflow: ReturnType<typeof mock>;
  let mockRandomUUID: ReturnType<typeof mock>;
  let generateMessage: (
    threadId: string
  ) => AsyncGenerator<GenerateMessagePayload>;

  // Default mock data
  const defaultThread: MockThread = {
    id: "thread-id",
    title: "Test Thread",
    userId: "user-id",
    selectedAgent: "test-agent",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultAgent = {
    name: "test-agent",
    model: "gpt-4",
    routerType: "simple" as const,
    systemMessage: "You are a helpful assistant",
    availableTools: [],
  };

  const defaultRouterAgent = {
    name: "router-agent",
    model: "gpt-4",
    routerType: "router" as const,
    systemMessage: "You are a router agent",
    availableTools: [],
    availableSubAgents: [{ name: "sub-agent" }],
  };

  const defaultAIModel = { modelName: "gpt-4" };

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
    mockFindUnique = mock();
    mockDBClient = {
      thread: {
        findUnique: mockFindUnique,
      },
    };
    mockServerError = mock();
    mockTruncateMessageHistory = mock();
    mockGetAgentByName = mock();
    mockGetModelDefinition = mock();
    mockGenerateMessageWithRouter = mock();
    mockGenerateMessageWithStandardWorkflow = mock();
    mockRandomUUID = mock();

    // Mock modules
    // Import Prisma types to re-export them
    const prismaTypes = await import("@prisma/client");
    void mock.module("../../../data/MongoDB/client", () => ({
      ...prismaTypes,
      DBClient: mockDBClient,
    }));

    // Import all error functions to re-export them
    const errors = await import("../../../graphql/errors");
    void mock.module("../../../graphql/errors", () => ({
      ...errors,
      ServerError: mockServerError,
    }));

    void mock.module("../../../data/AI/truncateMessageHistory", () => ({
      truncateMessageHistory: mockTruncateMessageHistory,
    }));

    void mock.module("../../../data/AI/agentList", () => ({
      getAgentByName: mockGetAgentByName,
    }));

    void mock.module("../../../data/AI/getModelDefinition", () => ({
      getModelDefinition: mockGetModelDefinition,
    }));

    void mock.module("../../../data/AI/generateMessageWithRouter", () => ({
      generateMessageWithRouter: mockGenerateMessageWithRouter,
    }));

    void mock.module(
      "../../../data/AI/generateMessageWithStandardWorkflow",
      () => ({
        generateMessageWithStandardWorkflow:
          mockGenerateMessageWithStandardWorkflow,
      })
    );

    void mock.module("crypto", () => ({
      randomUUID: mockRandomUUID,
    }));

    // Dynamic import
    const module = await import("./generateMessage");
    generateMessage = module.generateMessage;

    // Set up default mock behavior
    mockFindUnique.mockResolvedValue(defaultThread);
    mockGetAgentByName.mockReturnValue(defaultAgent);
    mockGetModelDefinition.mockReturnValue(defaultAIModel);
    mockTruncateMessageHistory.mockReturnValue([
      { role: "system", content: defaultAgent.systemMessage },
    ]);

    // Mock workflow generators to return async generators
    mockGenerateMessageWithStandardWorkflow.mockImplementation(
      async function* () {
        for (const result of defaultWorkflowResults) {
          await Promise.resolve(); // No-op await to satisfy async generator requirements
          yield result;
        }
      }
    );

    mockGenerateMessageWithRouter.mockImplementation(async function* () {
      await Promise.resolve(); // No-op await to satisfy async generator requirements
      yield { responseType: "Final", content: "Router response" };
    });

    mockRandomUUID.mockReturnValue("test-run-id");
    mockServerError.mockImplementation((msg: string) => new Error(msg));
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> generateMessage throws error when thread not found", () => {
    mockFindUnique.mockResolvedValue(null);

    const generator = generateMessage("non-existent-thread-id");

    expect(generator.next()).rejects.toThrow("Thread not found");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "non-existent-thread-id" },
      select: {
        userId: true,
        selectedAgent: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  });

  test("Unit -> generateMessage throws error when agent not found", async () => {
    const mockThread: MockThread = {
      ...defaultThread,
      selectedAgent: "invalid-agent",
    };

    mockFindUnique.mockResolvedValue(mockThread);
    mockGetAgentByName.mockReturnValue(null);

    const generator = generateMessage("thread-id");

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(generator.next()).rejects.toThrow("Invalid agent selected.");

    expect(mockGetAgentByName).toHaveBeenCalledWith("invalid-agent");
  });

  test("Unit -> generateMessage throws error when model definition invalid", async () => {
    mockGetModelDefinition.mockReturnValue(null);

    const generator = generateMessage("thread-id");

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(generator.next()).rejects.toThrow(
      "Invalid agent Configuration detected."
    );

    expect(mockGetModelDefinition).toHaveBeenCalledWith(defaultAgent);
  });

  test("Unit -> generateMessage uses standard workflow for simple agent", async () => {
    const mockMessages: Message[] = [{ ...defaultMessage, content: "Hello" }];

    const mockThread: MockThread = {
      ...defaultThread,
      messages: mockMessages,
    };

    mockFindUnique.mockResolvedValue(mockThread);
    mockGetAgentByName.mockReturnValue(defaultAgent);
    mockTruncateMessageHistory.mockReturnValue([
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello", tokenCount: 10 },
    ]);

    const generator = generateMessage("thread-id");
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      responseType: "Final",
      content: "Generated response",
    });

    expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
      messageList: mockMessages,
      agent: defaultAgent,
    });

    expect(mockGenerateMessageWithStandardWorkflow).toHaveBeenCalledWith({
      threadId: "thread-id",
      agent: defaultAgent,
      messageHistory: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello", tokenCount: 10 },
      ],
      runId: "test-run-id",
    });

    expect(mockGenerateMessageWithRouter).not.toHaveBeenCalled();
  });

  test("Unit -> generateMessage uses router workflow for router agent", async () => {
    const mockMessages: Message[] = [
      { ...defaultMessage, content: "Help me with character creation" },
    ];

    const mockThread: MockThread = {
      ...defaultThread,
      messages: mockMessages,
      selectedAgent: "router-agent",
    };

    mockFindUnique.mockResolvedValue(mockThread);
    mockGetAgentByName.mockReturnValue(defaultRouterAgent);
    mockTruncateMessageHistory.mockReturnValue([
      { role: "system", content: "You are a router agent" },
      {
        role: "user",
        content: "Help me with character creation",
        tokenCount: 10,
      },
    ]);

    const generator = generateMessage("thread-id");
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      responseType: "Final",
      content: "Router response",
    });

    expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
      messageList: mockMessages,
      agent: defaultRouterAgent,
    });

    expect(mockGenerateMessageWithRouter).toHaveBeenCalledWith({
      threadId: "thread-id",
      agent: defaultRouterAgent,
      messageHistory: [
        { role: "system", content: "You are a router agent" },
        {
          role: "user",
          content: "Help me with character creation",
          tokenCount: 10,
        },
      ],
      runId: "test-run-id",
    });

    expect(mockGenerateMessageWithStandardWorkflow).not.toHaveBeenCalled();
  });

  test("Unit -> generateMessage handles undefined routerType as simple", async () => {
    const agentWithoutRouterType = {
      ...defaultAgent,
      routerType: undefined,
    };

    mockGetAgentByName.mockReturnValue(agentWithoutRouterType);

    const generator = generateMessage("thread-id");
    const results: GenerateMessagePayload[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      responseType: "Final",
      content: "Generated response",
    });

    expect(mockGenerateMessageWithStandardWorkflow).toHaveBeenCalled();
    expect(mockGenerateMessageWithRouter).not.toHaveBeenCalled();
  });

  test("Unit -> generateMessage generates unique runId for each call", async () => {
    mockRandomUUID
      .mockReturnValueOnce("run-id-1")
      .mockReturnValueOnce("run-id-2");

    // First call
    const generator1 = generateMessage("thread-id");
    await generator1.next();

    // Second call
    const generator2 = generateMessage("thread-id");
    await generator2.next();

    expect(mockGenerateMessageWithStandardWorkflow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ runId: "run-id-1" })
    );
    expect(mockGenerateMessageWithStandardWorkflow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ runId: "run-id-2" })
    );
  });

  test("Unit -> generateMessage passes correct parameters to truncateMessageHistory", async () => {
    const mockMessages: Message[] = [
      { ...defaultMessage, content: "Test message" },
    ];

    const mockThread: MockThread = {
      ...defaultThread,
      messages: mockMessages,
    };

    mockFindUnique.mockResolvedValue(mockThread);

    const generator = generateMessage("thread-id");
    await generator.next();

    expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
      messageList: mockMessages,
      agent: defaultAgent,
    });
  });
});
