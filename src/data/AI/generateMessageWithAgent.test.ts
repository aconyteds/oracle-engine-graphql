import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { GenerateMessagePayload } from "../../generated/graphql";
import { RouterType } from "./types";

describe("generateMessageWithAgent", () => {
  let mockGetAgentDefinition: ReturnType<typeof mock>;
  let mockGetAgentByName: ReturnType<typeof mock>;
  let mockSaveMessage: ReturnType<typeof mock>;
  let mockTranslateMessage: ReturnType<typeof mock>;
  let mockEnqueueMessage: ReturnType<typeof mock>;
  let mockYieldMessage: ReturnType<typeof mock>;
  let generateMessageWithAgent: typeof import("./generateMessageWithAgent").generateMessageWithAgent;

  let defaultRequestContext: {
    userId: string;
    campaignId: string;
    threadId: string;
    runId: string;
    yieldMessage: ReturnType<typeof mock>;
  };

  const defaultMessageHistory: BaseMessage[] = [
    new HumanMessage("Test message"),
  ];

  const defaultSavedMessage = {
    id: "msg-1",
    content: "Response from agent",
    role: "assistant",
  };

  const defaultTranslatedMessage = {
    id: "msg-1",
    content: "Response from agent",
    role: "assistant",
  };

  const defaultAgent = {
    name: "test_agent",
    routerType: RouterType.None,
    availableTools: [],
  };

  beforeEach(async () => {
    mock.restore();

    mockGetAgentDefinition = mock();
    mockGetAgentByName = mock();
    mockSaveMessage = mock();
    mockTranslateMessage = mock();
    mockEnqueueMessage = mock();
    mockYieldMessage = mock();

    // Mock the PrismaCheckpointSaver class
    const MockCheckpointerClass = mock(() => ({
      getTuple: mock().mockResolvedValue(null),
    }));

    mock.module("./getAgentDefinition", () => ({
      getAgentDefinition: mockGetAgentDefinition,
    }));

    mock.module("./agentList", () => ({
      getAgentByName: mockGetAgentByName,
    }));

    mock.module("../MongoDB/saveMessage", () => ({
      saveMessage: mockSaveMessage,
    }));

    mock.module("../../modules/utils", () => ({
      TranslateMessage: mockTranslateMessage,
    }));

    mock.module("./Checkpointers", () => ({
      PrismaCheckpointSaver: MockCheckpointerClass,
    }));

    const module = await import("./generateMessageWithAgent");
    generateMessageWithAgent = module.generateMessageWithAgent;

    // Default mock behaviors
    mockSaveMessage.mockResolvedValue(defaultSavedMessage);
    mockTranslateMessage.mockReturnValue(defaultTranslatedMessage);

    // Recreate defaultRequestContext with fresh mockYieldMessage
    defaultRequestContext = {
      userId: "user-1",
      campaignId: "campaign-1",
      threadId: "thread-1",
      runId: "run-1",
      yieldMessage: mockYieldMessage,
    };
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> generateMessageWithAgent handles Handoff router with routing decision", async () => {
    // Create a mock router agent
    const routerAgent = {
      name: "test_router",
      routerType: RouterType.Handoff,
      availableTools: [],
    };

    // Create a mock target agent
    const targetAgent = {
      name: "target_agent",
      routerType: RouterType.None,
      availableTools: [],
    };

    // Mock router agent instance that returns a routing decision
    const routerStreamResult = {
      agent: {
        messages: [
          new HumanMessage("Test message"),
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call-1",
                name: "routeToAgent",
                args: { targetAgent: "target_agent", confidence: 3 },
              },
            ],
          }),
          new ToolMessage({
            content: JSON.stringify({
              type: "routing_decision",
              targetAgent: "target_agent",
              confidence: 3,
              reasoning: "Test routing",
            }),
            tool_call_id: "call-1",
            name: "routeToAgent",
          }),
          new AIMessage("Routing to target_agent"),
        ],
        structuredResponse: {
          targetAgent: "target_agent",
          confidence: 3,
          reasoning: "Test routing",
          fallbackAgent: "",
          intentKeywords: ["test", "routing"],
          contextFactors: [],
        },
      },
    };

    const mockRouterInstance = {
      stream: mock(async function* () {
        yield routerStreamResult;
      }),
    };

    // Mock target agent instance that returns a final response
    const targetStreamResult = {
      agent: {
        messages: [
          new HumanMessage("Test message"),
          new AIMessage("Final response from target agent"),
        ],
        structuredResponse: null,
      },
    };

    const mockTargetInstance = {
      stream: mock(async function* () {
        yield targetStreamResult;
      }),
    };

    mockGetAgentDefinition
      .mockReturnValueOnce(mockRouterInstance)
      .mockReturnValueOnce(mockTargetInstance);

    mockGetAgentByName.mockReturnValue(targetAgent);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: routerAgent as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    const enqueuedCalls = mockEnqueueMessage.mock.calls.map(
      // biome-ignore lint/suspicious/noExplicitAny: Mock call array type
      (call: any) => call[0]
    );
    const results: GenerateMessagePayload[] = enqueuedCalls;

    // Verify routing happened
    expect(mockGetAgentByName).toHaveBeenCalledWith("target_agent");
    expect(mockGetAgentDefinition).toHaveBeenCalledTimes(2); // Router + Target

    // Should have intermediate routing message
    const routingMessage = results.find(
      (r) => r.responseType === "Intermediate" && r.content?.includes("Routing")
    );
    expect(routingMessage).toBeDefined();

    // Should have final message from target agent
    const finalMessage = results.find((r) => r.responseType === "Final");
    expect(finalMessage).toBeDefined();
    expect(finalMessage?.content).toBe("Response from agent");

    // Verify saveMessage was called with target agent's response
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        content: "Final response from target agent",
        role: "assistant",
      })
    );
  });

  test("Unit -> generateMessageWithAgent handles non-router agent normally", async () => {
    const nonRouterAgent = {
      name: "normal_agent",
      routerType: RouterType.None,
      availableTools: [],
    };

    const streamResult = {
      agent: {
        messages: [
          new HumanMessage("Test message"),
          new AIMessage("Direct response"),
        ],
        structuredResponse: null,
      },
    };

    const mockAgentInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: nonRouterAgent as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    const results: GenerateMessagePayload[] = mockEnqueueMessage.mock.calls.map(
      // biome-ignore lint/suspicious/noExplicitAny: Mock call array type
      (call: any) => call[0]
    );

    // Should not attempt routing
    expect(mockGetAgentByName).not.toHaveBeenCalled();
    expect(mockGetAgentDefinition).toHaveBeenCalledTimes(1);

    // Should have final message
    const finalMessage = results.find((r) => r.responseType === "Final");
    expect(finalMessage).toBeDefined();

    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Direct response",
      })
    );
  });

  test("Unit -> generateMessageWithAgent handles Handoff router without routing decision", async () => {
    const routerAgent = {
      name: "test_router",
      routerType: RouterType.Handoff,
      availableTools: [],
    };

    // Router decides not to route and responds directly
    const streamResult = {
      agent: {
        messages: [
          new HumanMessage("Test message"),
          new AIMessage("Direct response from router"),
        ],
        structuredResponse: null,
      },
    };

    const mockRouterInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockRouterInstance);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: routerAgent as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    // Should not route since no routing decision was made
    expect(mockGetAgentByName).not.toHaveBeenCalled();

    // Should save the router's direct response
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Direct response from router",
      })
    );
  });

  test("Unit -> generateMessageWithAgent processes agent with tools successfully", async () => {
    const agentWithTools = {
      name: "tool_agent",
      routerType: RouterType.None,
      availableTools: [{ name: "calculator" }],
    };

    const streamResult = {
      agent: {
        messages: [
          new HumanMessage("What is 2+2?"),
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call-1",
                name: "calculator",
                args: { expression: "2+2" },
              },
            ],
          }),
          new ToolMessage({
            content: "4",
            tool_call_id: "call-1",
            name: "calculator",
          }),
          new AIMessage("The answer is 4"),
        ],
        structuredResponse: null,
      },
    };

    const mockAgentInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: agentWithTools as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    // Should save final message with the AI response
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        content: "The answer is 4",
        role: "assistant",
        runId: "run-1",
      })
    );

    // Should enqueue final message
    const finalMessage = mockEnqueueMessage.mock.calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: Mock call array type
      (call: any) => call[0].responseType === "Final"
    );
    expect(finalMessage).toBeDefined();
  });

  test("Unit -> generateMessageWithAgent throws error when getAgentDefinition returns null", async () => {
    mockGetAgentDefinition.mockReturnValue(null);

    await expect(
      generateMessageWithAgent({
        threadId: "thread-1",
        runId: "run-1",
        // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
        agent: defaultAgent as any,
        messageHistory: defaultMessageHistory,
        requestContext: defaultRequestContext,
        enqueueMessage: mockEnqueueMessage,
      })
    ).rejects.toThrow("Invalid agent configuration detected.");
  });

  test("Unit -> generateMessageWithAgent throws error when no assistant response generated", async () => {
    const streamResult = {
      agent: {
        messages: [new HumanMessage("Test message")],
        structuredResponse: null,
      },
    };

    const mockAgentInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    await expect(
      generateMessageWithAgent({
        threadId: "thread-1",
        runId: "run-1",
        // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
        agent: defaultAgent as any,
        messageHistory: defaultMessageHistory,
        requestContext: defaultRequestContext,
        enqueueMessage: mockEnqueueMessage,
      })
    ).rejects.toThrow();
  });

  test("Unit -> generateMessageWithAgent handles errors during invocation", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Agent invocation failed");
    const mockAgentInstance = {
      stream: mock(async function* () {
        throw testError;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    try {
      await expect(
        generateMessageWithAgent({
          threadId: "thread-1",
          runId: "run-1",
          // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
          agent: defaultAgent as any,
          messageHistory: defaultMessageHistory,
          requestContext: defaultRequestContext,
          enqueueMessage: mockEnqueueMessage,
        })
      ).rejects.toThrow("Error generating message with agent.");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in agent generation:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> generateMessageWithAgent yields debug info about tools and sub-agents", async () => {
    const agentWithToolsAndSubAgents = {
      name: "complex_agent",
      routerType: RouterType.None,
      availableTools: [{ name: "tool1" }, { name: "tool2" }],
      availableSubAgents: [{ name: "sub1" }],
    };

    const streamResult = {
      agent: {
        messages: [new HumanMessage("Test"), new AIMessage("Response")],
        structuredResponse: null,
      },
    };

    const mockAgentInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: agentWithToolsAndSubAgents as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    const results: GenerateMessagePayload[] = mockEnqueueMessage.mock.calls.map(
      // biome-ignore lint/suspicious/noExplicitAny: Mock call array type
      (call: any) => call[0]
    );

    const debugMessage = results.find((r) => r.responseType === "Debug");
    expect(debugMessage).toBeDefined();
    expect(debugMessage?.content).toContain("complex_agent");
    expect(debugMessage?.content).toContain("Tools: 2");
    expect(debugMessage?.content).toContain("Sub-agents: 1");
  });

  test("Unit -> generateMessageWithAgent throws error when target agent not found", async () => {
    const routerAgent = {
      name: "test_router",
      routerType: RouterType.Handoff,
      availableTools: [],
    };

    const streamResult = {
      agent: {
        messages: [new HumanMessage("Test message"), new AIMessage("")],
        structuredResponse: {
          targetAgent: "nonexistent_agent",
          confidence: 3,
          reasoning: "Test routing",
          fallbackAgent: "",
          intentKeywords: [],
          contextFactors: [],
        },
      },
    };

    const mockRouterInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockRouterInstance);
    mockGetAgentByName.mockReturnValue(null);

    await expect(
      generateMessageWithAgent({
        threadId: "thread-1",
        runId: "run-1",
        // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
        agent: routerAgent as any,
        messageHistory: defaultMessageHistory,
        requestContext: defaultRequestContext,
        enqueueMessage: mockEnqueueMessage,
      })
    ).rejects.toThrow();
  });

  test("Unit -> generateMessageWithAgent saves workspace entries including debug info", async () => {
    const agentWithTools = {
      name: "tool_agent",
      routerType: RouterType.None,
      availableTools: [{ name: "calculator" }],
    };

    const streamResult = {
      agent: {
        messages: [
          new HumanMessage("What is 2+2?"),
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call-1",
                name: "calculator",
                args: { expression: "2+2" },
              },
            ],
          }),
          new ToolMessage({
            content: "4",
            tool_call_id: "call-1",
            name: "calculator",
          }),
          new AIMessage("The answer is 4"),
        ],
        structuredResponse: null,
      },
    };

    const mockAgentInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: agentWithTools as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    // Should save workspace with debug information about agent configuration
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.arrayContaining([
          expect.objectContaining({
            messageType: "Debug",
            content: expect.stringContaining("tool_agent"),
          }),
        ]),
      })
    );
  });

  test("Unit -> generateMessageWithAgent uses only last message when checkpoint exists", async () => {
    const mockCheckpointerInstance = {
      getTuple: mock().mockResolvedValue({
        checkpoint: { some: "data" },
      }),
    };

    const MockCheckpointerClass = mock(() => mockCheckpointerInstance);

    mock.module("./Checkpointers", () => ({
      PrismaCheckpointSaver: MockCheckpointerClass,
    }));

    const module = await import("./generateMessageWithAgent");
    const testGenerateMessageWithAgent = module.generateMessageWithAgent;

    const streamResult = {
      agent: {
        messages: [
          new HumanMessage("Latest message"),
          new AIMessage("Response"),
        ],
        structuredResponse: null,
      },
    };

    const mockStream = mock(async function* () {
      yield streamResult;
    });

    const mockAgentInstance = {
      stream: mockStream,
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    const multiMessageHistory: BaseMessage[] = [
      new HumanMessage("Old message 1"),
      new AIMessage("Old response 1"),
      new HumanMessage("Old message 2"),
      new AIMessage("Old response 2"),
      new HumanMessage("Latest message"),
    ];

    await testGenerateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: defaultAgent as any,
      messageHistory: multiMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    // Should only pass the last message
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [multiMessageHistory[multiMessageHistory.length - 1]],
      }),
      expect.anything()
    );
  });

  test("Unit -> generateMessageWithAgent handles multiple tool calls in message history", async () => {
    const agentWithTools = {
      name: "multi_tool_agent",
      routerType: RouterType.None,
      availableTools: [{ name: "calculator" }, { name: "dice_roller" }],
    };

    const streamResult = {
      agent: {
        messages: [
          new HumanMessage("Calculate 2+2 and roll a d20"),
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call-1",
                name: "calculator",
                args: { expression: "2+2" },
              },
              {
                id: "call-2",
                name: "dice_roller",
                args: { dice: "1d20" },
              },
            ],
          }),
          new ToolMessage({
            content: "4",
            tool_call_id: "call-1",
            name: "calculator",
          }),
          new ToolMessage({
            content: "15",
            tool_call_id: "call-2",
            name: "dice_roller",
          }),
          new AIMessage("The answer is 4 and you rolled a 15"),
        ],
        structuredResponse: null,
      },
    };

    const mockAgentInstance = {
      stream: mock(async function* () {
        yield streamResult;
      }),
    };

    mockGetAgentDefinition.mockReturnValue(mockAgentInstance);

    await generateMessageWithAgent({
      threadId: "thread-1",
      runId: "run-1",
      // biome-ignore lint/suspicious/noExplicitAny: Mock agent for testing
      agent: agentWithTools as any,
      messageHistory: defaultMessageHistory,
      requestContext: defaultRequestContext,
      enqueueMessage: mockEnqueueMessage,
    });

    // Should successfully process agent with multiple tools and save final response
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "The answer is 4 and you rolled a 15",
        role: "assistant",
      })
    );

    // Should enqueue final message
    const finalMessage = mockEnqueueMessage.mock.calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: Mock call array type
      (call: any) => call[0].responseType === "Final"
    );
    expect(finalMessage).toBeDefined();
  });
});
