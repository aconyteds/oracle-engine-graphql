import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("generateMessage", () => {
  let mockGenerateMessageWithRouter: ReturnType<typeof mock>;
  let mockGenerateMessageWithStandardWorkflow: ReturnType<typeof mock>;
  let mockFindUnique: ReturnType<typeof mock>;
  let mockDBClient: {
    thread: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let mockGetModelDefinition: ReturnType<typeof mock>;
  let mockGetAgentByName: ReturnType<typeof mock>;
  let generateMessage: (
    threadId: string
  ) => AsyncGenerator<{ responseType: string; content: string }>;

  beforeEach(async () => {
    mock.restore();

    // Create mocks
    mockGenerateMessageWithRouter = mock();
    mockGenerateMessageWithStandardWorkflow = mock();
    mockFindUnique = mock();
    mockDBClient = {
      thread: {
        findUnique: mockFindUnique,
      },
    };
    mockGetModelDefinition = mock().mockReturnValue({
      modelName: "gpt-4.1-nano",
      contextWindow: 100000,
    });
    mockGetAgentByName = mock();

    // Mock modules
    void mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    void mock.module("../../../data/AI/truncateMessageHistory", () => ({
      truncateMessageHistory: mock().mockReturnValue([]),
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

    void mock.module("../../../graphql/errors", () => ({
      ServerError: mock().mockImplementation((msg: string) => new Error(msg)),
    }));

    void mock.module("crypto", () => ({
      randomUUID: mock().mockReturnValue("test-run-id"),
    }));

    // Dynamic import
    const module = await import("./generateMessage");
    generateMessage = module.generateMessage as (
      threadId: string
    ) => AsyncGenerator<{ responseType: string; content: string }>;

    // Configure mocks
    mockFindUnique.mockResolvedValue({
      userId: "user-1",
      selectedAgent: "TestAgent",
      messages: [],
    });

    // Mock workflow generators to return async generators
    mockGenerateMessageWithRouter.mockImplementation(async function* () {
      await Promise.resolve(); // Ensure the function contains an await expression
      yield { responseType: "Final", content: "Router response" };
    });

    mockGenerateMessageWithStandardWorkflow.mockImplementation(
      async function* () {
        await Promise.resolve(); // Ensure the function contains an await expression
        yield { responseType: "Final", content: "Standard response" };
      }
    );
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> generateMessage uses router workflow for router agents", async () => {
    // Mock a router agent
    mockGetAgentByName.mockReturnValue({
      name: "MainRouter",
      routerType: "router",
      model: { modelName: "gpt-4.1-nano" },
      systemMessage: "Test router",
      availableTools: [],
      availableSubAgents: [{ name: "SubAgent" }],
    });

    const generator = generateMessage("test-thread");
    const results = [];

    for await (const result of generator) {
      results.push(result);
    }

    // Should have called the router function
    expect(mockGenerateMessageWithRouter).toHaveBeenCalledWith({
      threadId: "test-thread",
      agent: expect.objectContaining({
        name: "MainRouter",
        routerType: "router",
      }) as unknown,
      messageHistory: expect.any(Array) as unknown,
      runId: "test-run-id",
    });
    expect(mockGenerateMessageWithStandardWorkflow).not.toHaveBeenCalled();
    expect(results[0].content).toBe("Router response");
  });

  test("Unit -> generateMessage uses standard workflow for simple agents", async () => {
    // Mock a simple agent
    mockGetAgentByName.mockReturnValue({
      name: "Cheapest",
      routerType: "simple",
      model: { modelName: "gpt-4.1-nano" },
      systemMessage: "Test agent",
      availableTools: [],
    });

    const generator = generateMessage("test-thread");
    const results = [];

    for await (const result of generator) {
      results.push(result);
    }

    // Should have called the standard workflow function
    expect(mockGenerateMessageWithStandardWorkflow).toHaveBeenCalledWith({
      threadId: "test-thread",
      agent: expect.objectContaining({
        name: "Cheapest",
        routerType: "simple",
      }) as unknown,
      messageHistory: expect.any(Array) as unknown,
      runId: "test-run-id",
    });
    expect(mockGenerateMessageWithRouter).not.toHaveBeenCalled();
    expect(results[0].content).toBe("Standard response");
  });
});
