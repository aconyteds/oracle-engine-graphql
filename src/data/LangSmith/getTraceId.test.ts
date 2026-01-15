import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Message } from "@prisma/client";

describe("getTraceId", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockDBClient: {
    message: {
      findUnique: ReturnType<typeof mock>;
      update: ReturnType<typeof mock>;
    };
  };
  let mockLangSmithClient: {
    listRuns: ReturnType<typeof mock>;
  };
  let mockENV: {
    LANGSMITH_PROJECT: string;
  };
  let getTraceId: typeof import("./getTraceId").getTraceId;

  // Default mock data - reusable across tests
  const defaultMessageId = "msg-123";
  const defaultRunId = "run-456";
  const defaultTraceId = "trace-789";

  const defaultMessage: Message = {
    id: defaultMessageId,
    runId: defaultRunId,
    langSmithTraceId: null,
    threadId: "thread-1",
    role: "assistant",
    content: "Test message",
    tokenCount: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: [],
    routingMetadata: null,
    humanSentiment: null,
    feedbackComments: null,
  };

  const defaultRun = {
    trace_id: defaultTraceId,
    id: defaultRunId,
    metadata: { runId: defaultRunId },
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    const mockFindUnique = mock();
    const mockUpdate = mock();
    const mockListRuns = mock();

    mockDBClient = {
      message: {
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
    };

    mockLangSmithClient = {
      listRuns: mockListRuns,
    };

    mockENV = {
      LANGSMITH_PROJECT: "test-project",
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("./client", () => ({
      LangSmithClient: mockLangSmithClient,
    }));

    mock.module("../../config/environment", () => ({
      ENV: mockENV,
    }));

    // Dynamically import the module under test
    const module = await import("./getTraceId");
    getTraceId = module.getTraceId;

    // Configure default mock behavior AFTER import
    mockDBClient.message.findUnique.mockResolvedValue(defaultMessage);
    mockDBClient.message.update.mockResolvedValue({
      ...defaultMessage,
      langSmithTraceId: defaultTraceId,
    });

    // Mock async iterator for listRuns
    mockLangSmithClient.listRuns.mockReturnValue(
      (async function* () {
        yield defaultRun;
      })()
    );
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getTraceId returns cached trace ID if already fetched", async () => {
    const cachedTraceId = "cached-trace-123";
    mockDBClient.message.findUnique.mockResolvedValue({
      ...defaultMessage,
      langSmithTraceId: cachedTraceId,
    });

    const result = await getTraceId(defaultMessageId);

    expect(result).toBe(cachedTraceId);
    expect(mockDBClient.message.findUnique).toHaveBeenCalledWith({
      where: { id: defaultMessageId },
    });
    // Should not call listRuns or update when cached
    expect(mockLangSmithClient.listRuns).not.toHaveBeenCalled();
    expect(mockDBClient.message.update).not.toHaveBeenCalled();
  });

  test("Unit -> getTraceId fetches and caches trace ID when not cached", async () => {
    const result = await getTraceId(defaultMessageId);

    expect(result).toBe(defaultTraceId);
    expect(mockDBClient.message.findUnique).toHaveBeenCalledWith({
      where: { id: defaultMessageId },
    });
    expect(mockLangSmithClient.listRuns).toHaveBeenCalledWith({
      projectName: mockENV.LANGSMITH_PROJECT,
      filter: `has(metadata, '{"runId": "${defaultRunId}"}')`,
      limit: 1,
    });
    expect(mockDBClient.message.update).toHaveBeenCalledWith({
      where: { id: defaultMessageId },
      data: { langSmithTraceId: defaultTraceId },
    });
  });

  test("Unit -> getTraceId returns null when message not found", async () => {
    const originalConsoleInfo = console.info;
    const mockConsoleInfo = mock();
    console.info = mockConsoleInfo;

    mockDBClient.message.findUnique.mockResolvedValue(null);

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        `No runId found for message ID: ${defaultMessageId}. Cannot fetch trace ID. This likely means this message was not AI generated.`
      );
      expect(mockLangSmithClient.listRuns).not.toHaveBeenCalled();
      expect(mockDBClient.message.update).not.toHaveBeenCalled();
    } finally {
      console.info = originalConsoleInfo;
    }
  });

  test("Unit -> getTraceId returns null when message has no runId", async () => {
    const originalConsoleInfo = console.info;
    const mockConsoleInfo = mock();
    console.info = mockConsoleInfo;

    mockDBClient.message.findUnique.mockResolvedValue({
      ...defaultMessage,
      runId: null,
    });

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        `No runId found for message ID: ${defaultMessageId}. Cannot fetch trace ID. This likely means this message was not AI generated.`
      );
      expect(mockLangSmithClient.listRuns).not.toHaveBeenCalled();
      expect(mockDBClient.message.update).not.toHaveBeenCalled();
    } finally {
      console.info = originalConsoleInfo;
    }
  });

  test("Unit -> getTraceId returns null when no trace ID found in LangSmith", async () => {
    const originalConsoleInfo = console.info;
    const mockConsoleInfo = mock();
    console.info = mockConsoleInfo;

    // Mock empty async iterator
    mockLangSmithClient.listRuns.mockReturnValue(
      (async function* () {
        // No results
      })()
    );

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        `No trace ID found for runId: ${defaultRunId}. This likely means the run was not sampled.`
      );
      expect(mockDBClient.message.update).not.toHaveBeenCalled();
    } finally {
      console.info = originalConsoleInfo;
    }
  });

  test("Unit -> getTraceId handles errors gracefully", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const testError = new Error("Database connection failed");
    mockDBClient.message.findUnique.mockRejectedValue(testError);

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `Error fetching trace ID for message ID: ${defaultMessageId}`,
        testError
      );
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> getTraceId handles LangSmith API errors gracefully", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const testError = new Error("LangSmith API error");
    mockLangSmithClient.listRuns.mockImplementation(() => {
      throw testError;
    });

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `Error fetching trace ID for message ID: ${defaultMessageId}`,
        testError
      );
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> getTraceId handles database update errors gracefully", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const testError = new Error("Database update failed");
    mockDBClient.message.update.mockRejectedValue(testError);

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `Error fetching trace ID for message ID: ${defaultMessageId}`,
        testError
      );
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> getTraceId handles run with undefined trace_id", async () => {
    const originalConsoleInfo = console.info;
    const mockConsoleInfo = mock();
    console.info = mockConsoleInfo;

    // Mock async iterator with undefined trace_id
    mockLangSmithClient.listRuns.mockReturnValue(
      (async function* () {
        yield { ...defaultRun, trace_id: undefined };
      })()
    );

    try {
      const result = await getTraceId(defaultMessageId);

      expect(result).toBeNull();
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        `No trace ID found for runId: ${defaultRunId}. This likely means the run was not sampled.`
      );
      expect(mockDBClient.message.update).not.toHaveBeenCalled();
    } finally {
      console.info = originalConsoleInfo;
    }
  });

  test("Unit -> getTraceId uses correct filter format with runId", async () => {
    const customRunId = "custom-run-999";
    mockDBClient.message.findUnique.mockResolvedValue({
      ...defaultMessage,
      runId: customRunId,
    });

    await getTraceId(defaultMessageId);

    expect(mockLangSmithClient.listRuns).toHaveBeenCalledWith({
      projectName: mockENV.LANGSMITH_PROJECT,
      filter: `has(metadata, '{"runId": "${customRunId}"}')`,
      limit: 1,
    });
  });
});
