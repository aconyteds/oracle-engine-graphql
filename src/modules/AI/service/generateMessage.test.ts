import { test, expect, beforeEach, mock } from "bun:test";
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

const mockDBClient = {
  thread: {
    findUnique: mock(),
  },
};

const mockServerError = mock();
const mockTruncateMessageHistory = mock();
const mockGetAgentByName = mock();
const mockGetModelDefinition = mock();
const mockGenerateMessageWithRouter = mock();
const mockGenerateMessageWithStandardWorkflow = mock();
const mockRandomUUID = mock();

void mock.module("../../../data/MongoDB", () => ({
  DBClient: mockDBClient,
}));

void mock.module("../../../graphql/errors", () => ({
  ServerError: mockServerError,
}));

void mock.module("../../../data/AI", () => ({
  truncateMessageHistory: mockTruncateMessageHistory,
  getAgentByName: mockGetAgentByName,
  getModelDefinition: mockGetModelDefinition,
  generateMessageWithRouter: mockGenerateMessageWithRouter,
  generateMessageWithStandardWorkflow: mockGenerateMessageWithStandardWorkflow,
}));

void mock.module("crypto", () => ({
  randomUUID: mockRandomUUID,
}));

import { generateMessage } from "./generateMessage";

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

beforeEach(() => {
  // Clear all mocks
  mockDBClient.thread.findUnique.mockClear();
  mockServerError.mockClear();
  mockTruncateMessageHistory.mockClear();
  mockGetAgentByName.mockClear();
  mockGetModelDefinition.mockClear();
  mockGenerateMessageWithRouter.mockClear();
  mockGenerateMessageWithStandardWorkflow.mockClear();
  mockRandomUUID.mockClear();

  // Set up default mock behavior
  mockDBClient.thread.findUnique.mockResolvedValue(defaultThread);
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

test("Unit -> generateMessage throws error when thread not found", () => {
  mockDBClient.thread.findUnique.mockResolvedValue(null);

  const generator = generateMessage("non-existent-thread-id");

  expect(generator.next()).rejects.toThrow("Thread not found");

  expect(mockDBClient.thread.findUnique).toHaveBeenCalledWith({
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

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);
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

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);
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

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);
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

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);

  const generator = generateMessage("thread-id");
  await generator.next();

  expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
    messageList: mockMessages,
    agent: defaultAgent,
  });
});
