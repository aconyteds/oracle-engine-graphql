import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AIMessage, HumanMessage } from "langchain";
import type { Message, Thread } from "../../../data/MongoDB";
import type { GenerateMessagePayload } from "../../../generated/graphql";
import { GenerateMessageProps } from "./generateMessage";

type MockThread = Thread & {
  messages: Message[];
};

describe("Unit -> generateMessage", () => {
  // Mock variables
  let mockFindUnique: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let mockServerError: ReturnType<typeof mock>;
  let mockGenerateMessageWithAgent: ReturnType<typeof mock>;
  let mockRandomUUID: ReturnType<typeof mock>;
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
    mockFindUnique = mock();
    mockDBClient = {
      thread: {
        findUnique: mockFindUnique,
      },
    };
    mockServerError = mock();
    mockGenerateMessageWithAgent = mock();
    mockRandomUUID = mock();

    // Mock modules
    const prismaTypes = await import("@prisma/client");
    void mock.module("../../../data/MongoDB/client", () => ({
      ...prismaTypes,
      DBClient: mockDBClient,
    }));

    const errors = await import("../../../graphql/errors");
    void mock.module("../../../graphql/errors", () => ({
      ...errors,
      ServerError: mockServerError,
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

    // Dynamic import
    const module = await import("./generateMessage");
    generateMessage = module.generateMessage;

    // Set up default mock behavior
    mockFindUnique.mockResolvedValue(defaultThread);

    mockGenerateMessageWithAgent.mockImplementation(async function* () {
      for (const result of defaultWorkflowResults) {
        await Promise.resolve();
        yield result;
      }
    });

    mockRandomUUID.mockReturnValue("test-run-id");
    mockServerError.mockImplementation((msg: string) => new Error(msg));
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> generateMessage throws error when thread not found", () => {
    mockFindUnique.mockResolvedValue(null);

    const generator = generateMessage({
      ...defaultInput,
      threadId: "non-existent-thread-id",
    });

    expect(generator.next()).rejects.toThrow("Thread not found");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "non-existent-thread-id" },
      select: {
        campaignId: true,
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

    mockFindUnique.mockResolvedValue(mockThread);

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

    mockFindUnique.mockResolvedValue(mockThread);

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
      },
    });
  });

  test("Unit -> generateMessage handles empty message history", async () => {
    const mockThread: MockThread = {
      ...defaultThread,
      messages: [],
    };

    mockFindUnique.mockResolvedValue(mockThread);

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

    mockFindUnique.mockResolvedValue(mockThread);

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
      },
    });
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
});
