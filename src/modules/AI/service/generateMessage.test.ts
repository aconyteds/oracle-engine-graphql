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
const mockRunToolEnabledWorkflow = mock();
const mockSaveMessage = mock();
const mockTranslateMessage = mock();
const mockRandomUUID = mock();

mock.module("../../../data/MongoDB", () => ({
  DBClient: mockDBClient,
  saveMessage: mockSaveMessage,
}));

mock.module("../../../graphql/errors", () => ({
  ServerError: mockServerError,
}));

mock.module("../../../data/AI", () => ({
  truncateMessageHistory: mockTruncateMessageHistory,
  getAgentByName: mockGetAgentByName,
  getModelDefinition: mockGetModelDefinition,
  runToolEnabledWorkflow: mockRunToolEnabledWorkflow,
}));

mock.module("../../utils", () => ({
  TranslateMessage: mockTranslateMessage,
}));

mock.module("crypto", () => ({
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
  model: "gpt-4",
  useHistory: true,
  systemMessage: "You are a helpful assistant",
  availableTools: [],
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
};

const defaultWorkflowResult = {
  currentResponse: "Generated response",
  metadata: {
    hasToolCalls: false,
    toolExecutionResults: [],
  },
  toolCallsForDB: [],
  toolResultsForDB: [],
};

const defaultSavedMessage: Message = {
  id: "new-msg-id",
  role: "assistant",
  content: "Generated response",
  tokenCount: 25,
  workspace: [],
  threadId: "thread-id",
  runId: "test-run-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultTranslatedMessage = {
  id: "new-msg-id",
  content: "Generated response",
  createdAt: new Date().toISOString(),
  threadId: "thread-id",
  role: "Assistant" as const,
  tokenCount: 25,
  workspace: [],
};

beforeEach(() => {
  // Clear all mocks
  mockDBClient.thread.findUnique.mockClear();
  mockServerError.mockClear();
  mockTruncateMessageHistory.mockClear();
  mockGetAgentByName.mockClear();
  mockGetModelDefinition.mockClear();
  mockRunToolEnabledWorkflow.mockClear();
  mockSaveMessage.mockClear();
  mockTranslateMessage.mockClear();
  mockRandomUUID.mockClear();

  // Set up default mock behavior
  mockDBClient.thread.findUnique.mockResolvedValue(defaultThread);
  mockGetAgentByName.mockReturnValue(defaultAgent);
  mockGetModelDefinition.mockReturnValue(defaultAIModel);
  mockTruncateMessageHistory.mockReturnValue([
    { role: "system", content: defaultAgent.systemMessage },
  ]);
  mockRunToolEnabledWorkflow.mockResolvedValue(defaultWorkflowResult);
  mockSaveMessage.mockResolvedValue(defaultSavedMessage);
  mockTranslateMessage.mockReturnValue(defaultTranslatedMessage);
  mockRandomUUID.mockReturnValue("test-run-id");
  mockServerError.mockImplementation((msg: string) => new Error(msg));
});

test("Unit -> generateMessage throws error when thread not found", async () => {
  mockDBClient.thread.findUnique.mockResolvedValue(null);

  const generator = generateMessage("non-existent-thread-id");

  await expect(async () => {
    await generator.next();
  }).toThrow("Thread not found");

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

  await expect(async () => {
    await generator.next();
  }).toThrow("Invalid agent selected.");

  expect(mockGetAgentByName).toHaveBeenCalledWith("invalid-agent");
});

test("Unit -> generateMessage throws error when model definition invalid", async () => {
  mockGetModelDefinition.mockReturnValue(null);

  const generator = generateMessage("thread-id");

  await expect(async () => {
    await generator.next();
  }).toThrow("Invalid agent Configuration detected.");

  expect(mockGetModelDefinition).toHaveBeenCalledWith(defaultAgent);
});

test("Unit -> generateMessage processes thread with history enabled", async () => {
  const mockMessages: Message[] = [
    { ...defaultMessage, content: "Hello" },
    {
      ...defaultMessage,
      id: "msg-2",
      role: "assistant",
      content: "Hi there!",
      tokenCount: 15,
    },
  ];

  const mockThread: MockThread = {
    ...defaultThread,
    messages: mockMessages,
  };

  const mockAgent = {
    ...defaultAgent,
    availableTools: [{ name: "calculator" }],
  };

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);
  mockGetAgentByName.mockReturnValue(mockAgent);
  mockTruncateMessageHistory.mockReturnValue([
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Hello", tokenCount: 10 },
    { role: "assistant", content: "Hi there!", tokenCount: 15 },
  ]);

  const generator = generateMessage("thread-id");
  const results: GenerateMessagePayload[] = [];

  for await (const result of generator) {
    results.push(result);
  }

  expect(results).toHaveLength(2);
  expect(results[0]).toEqual({
    responseType: "Debug",
    content: "🔧 Tools available: calculator",
  });
  expect(results[1]).toEqual({
    responseType: "Final",
    content: "Generated response",
    message: {
      ...defaultTranslatedMessage,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      createdAt: expect.any(String),
    },
  });

  expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
    messageList: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello", tokenCount: 10 },
      { role: "assistant", content: "Hi there!", tokenCount: 15 },
    ],
    model: "gpt-4",
  });

  expect(mockSaveMessage).toHaveBeenCalledWith({
    threadId: "thread-id",
    content: "Generated response",
    role: "assistant",
    workspace: [
      {
        messageType: "Debug",
        content: "🔧 Tools available: calculator",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        timestamp: expect.any(Date),
        elapsedTime: null,
      },
    ],
    runId: "test-run-id",
  });
});

test("Unit -> generateMessage processes thread without history", async () => {
  const mockMessages: Message[] = [
    {
      ...defaultMessage,
      content: "What is 2+2?",
      createdAt: new Date("2023-01-01"),
    },
    {
      ...defaultMessage,
      id: "msg-2",
      role: "assistant",
      content: "4",
      tokenCount: 5,
      createdAt: new Date("2023-01-02"),
    },
    {
      ...defaultMessage,
      id: "msg-3",
      content: "What about 3+3?",
      tokenCount: 12,
      createdAt: new Date("2023-01-03"),
    },
  ];

  const mockThread: MockThread = {
    ...defaultThread,
    messages: mockMessages,
  };

  const mockAgent = {
    ...defaultAgent,
    useHistory: false,
    systemMessage: "You are a calculator",
  };

  const mockWorkflowResult = {
    ...defaultWorkflowResult,
    currentResponse: "6",
  };

  const mockSavedMessage: Message = {
    ...defaultSavedMessage,
    content: "6",
    tokenCount: 5,
  };

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);
  mockGetAgentByName.mockReturnValue(mockAgent);
  mockTruncateMessageHistory.mockReturnValue([
    { role: "system", content: "You are a calculator" },
    { role: "user", content: "What about 3+3?", tokenCount: 12 },
  ]);
  mockRunToolEnabledWorkflow.mockResolvedValue(mockWorkflowResult);
  mockSaveMessage.mockResolvedValue(mockSavedMessage);
  mockTranslateMessage.mockReturnValue({
    ...defaultTranslatedMessage,
    content: "6",
    tokenCount: 5,
  });

  const generator = generateMessage("thread-id");
  const results: GenerateMessagePayload[] = [];

  for await (const result of generator) {
    results.push(result);
  }

  expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
    messageList: [
      { role: "system", content: "You are a calculator" },
      { role: "user", content: "What about 3+3?", tokenCount: 12 },
    ],
    model: "gpt-4",
  });
});

test("Unit -> generateMessage handles tool calls and results", async () => {
  const mockThread: MockThread = {
    ...defaultThread,
    selectedAgent: "tool-agent",
    messages: [
      { ...defaultMessage, content: "Calculate 15 * 8", tokenCount: 15 },
    ],
  };

  const mockAgent = {
    ...defaultAgent,
    systemMessage: "You are a helpful assistant with tools",
    availableTools: [{ name: "calculator" }, { name: "dice" }],
  };

  const mockWorkflowResult = {
    currentResponse: "The calculation result is 120.",
    metadata: {
      hasToolCalls: true,
      toolExecutionResults: ["calculator"],
    },
    toolCallsForDB: [
      {
        toolName: "calculator",
        arguments: '{"expression": "15 * 8"}',
        dateOccurred: new Date("2023-01-01T12:00:00Z"),
      },
    ],
    toolResultsForDB: [
      {
        result: "120",
        elapsedTime: 150,
        dateOccurred: new Date("2023-01-01T12:00:01Z"),
      },
    ],
  };

  const mockSavedMessage: Message = {
    ...defaultSavedMessage,
    content: "The calculation result is 120.",
    tokenCount: 30,
  };

  mockDBClient.thread.findUnique.mockResolvedValue(mockThread);
  mockGetAgentByName.mockReturnValue(mockAgent);
  mockTruncateMessageHistory.mockReturnValue([
    { role: "system", content: "You are a helpful assistant with tools" },
    { role: "user", content: "Calculate 15 * 8", tokenCount: 15 },
  ]);
  mockRunToolEnabledWorkflow.mockResolvedValue(mockWorkflowResult);
  mockSaveMessage.mockResolvedValue(mockSavedMessage);
  mockTranslateMessage.mockReturnValue({
    ...defaultTranslatedMessage,
    content: "The calculation result is 120.",
    tokenCount: 30,
  });

  const generator = generateMessage("thread-id");
  const results: GenerateMessagePayload[] = [];

  for await (const result of generator) {
    results.push(result);
  }

  expect(results).toHaveLength(3);
  expect(results[0]).toEqual({
    responseType: "Debug",
    content: "🔧 Tools available: calculator, dice",
  });
  expect(results[1]).toEqual({
    responseType: "Intermediate",
    content: "🛠️ Used tools: calculator",
  });
  expect(results[2]).toEqual({
    responseType: "Final",
    content: "The calculation result is 120.",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    message: expect.any(Object),
  });

  expect(mockSaveMessage).toHaveBeenCalledWith({
    threadId: "thread-id",
    content: "The calculation result is 120.",
    role: "assistant",
    workspace: [
      {
        messageType: "Debug",
        content: "🔧 Tools available: calculator, dice",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        timestamp: expect.any(Date),
        elapsedTime: null,
      },
      {
        messageType: "tool_call",
        content:
          '\ntool_name: **calculator**\n\narguments: \n{\n  "expression": "15 * 8"\n}',
        timestamp: new Date("2023-01-01T12:00:00Z"),
        elapsedTime: null,
      },
      {
        messageType: "tool_result",
        content: "120",
        elapsedTime: 150,
        timestamp: new Date("2023-01-01T12:00:01Z"),
      },
    ],
    runId: "test-run-id",
  });
});

test("Unit -> generateMessage handles workflow error", async () => {
  // Mock console.error to suppress output and verify it's called
  const originalConsoleError = console.error;
  const mockConsoleError = mock();
  console.error = mockConsoleError;

  const mockError = new Error("Workflow failed");
  mockRunToolEnabledWorkflow.mockRejectedValue(mockError);

  try {
    const generator = generateMessage("thread-id");

    // Get the first result (Debug message)
    const firstResult = await generator.next();
    expect(firstResult.value).toEqual({
      responseType: "Debug",
      content: "🔧 Tools available: ",
    });

    // The next call should throw an error
    await expect(generator.next()).rejects.toThrow(
      "Error generating message with tools."
    );

    // Verify console.error was called with the expected message
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Error in tool-enabled generation:",
      mockError
    );
  } finally {
    // Restore original console.error
    console.error = originalConsoleError;
  }
});

test("Unit -> generateMessage handles empty thread messages", async () => {
  const mockAgent = {
    ...defaultAgent,
    useHistory: false,
  };

  const mockWorkflowResult = {
    ...defaultWorkflowResult,
    currentResponse: "Hello! How can I help you?",
  };

  const mockSavedMessage: Message = {
    ...defaultSavedMessage,
    content: "Hello! How can I help you?",
    tokenCount: 20,
  };

  mockGetAgentByName.mockReturnValue(mockAgent);
  mockTruncateMessageHistory.mockReturnValue([
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "" },
  ]);
  mockRunToolEnabledWorkflow.mockResolvedValue(mockWorkflowResult);
  mockSaveMessage.mockResolvedValue(mockSavedMessage);
  mockTranslateMessage.mockReturnValue({
    ...defaultTranslatedMessage,
    content: "Hello! How can I help you?",
    tokenCount: 20,
  });

  const generator = generateMessage("thread-id");
  const results: GenerateMessagePayload[] = [];

  for await (const result of generator) {
    results.push(result);
  }

  expect(results).toHaveLength(2);
  expect(mockTruncateMessageHistory).toHaveBeenCalledWith({
    messageList: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "" },
    ],
    model: "gpt-4",
  });
});
