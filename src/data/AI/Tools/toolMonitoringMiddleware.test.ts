import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("toolMonitoringMiddleware", () => {
  let mockSentryMetrics: {
    count: ReturnType<typeof mock>;
  };
  let mockSentryCaptureException: ReturnType<typeof mock>;
  let mockMessageFactory: {
    toolUsage: ReturnType<typeof mock>;
  };
  let mockYieldMessage: ReturnType<typeof mock>;
  let toolMonitoringMiddleware: typeof import("./toolMonitoringMiddleware").toolMonitoringMiddleware;
  // biome-ignore lint/suspicious/noExplicitAny: Mock function types for testing
  let wrapToolCallFn: (request: any, handler: any) => any;

  const defaultToolCall = {
    id: "call-1",
    name: "calculator",
    args: { expression: "2+2" },
  };

  const defaultYieldPayload = {
    responseType: "Intermediate",
    content: "🛠️ Calculator",
  };

  let defaultRequest: {
    toolCall: typeof defaultToolCall;
    runtime: {
      context: {
        userId: string;
        campaignId: string;
        threadId: string;
        runId: string;
        yieldMessage: ReturnType<typeof mock>;
      };
    };
  };

  beforeEach(async () => {
    mock.restore();

    const mockCountFn = mock();
    mockSentryMetrics = {
      count: mockCountFn,
    };
    mockSentryCaptureException = mock();
    mockYieldMessage = mock();

    const mockToolUsage = mock();
    mockMessageFactory = {
      toolUsage: mockToolUsage,
    };

    // Mock createMiddleware to capture the config
    const mockCreateMiddleware = mock((config) => {
      wrapToolCallFn = config.wrapToolCall;
      return {
        name: config.name,
        wrapToolCall: config.wrapToolCall,
      };
    });

    mock.module("langchain", () => ({
      createMiddleware: mockCreateMiddleware,
    }));

    mock.module("@sentry/bun", () => ({
      metrics: mockSentryMetrics,
      captureException: mockSentryCaptureException,
    }));

    mock.module("../messageFactory", () => ({
      MessageFactory: mockMessageFactory,
    }));

    const module = await import("./toolMonitoringMiddleware");
    toolMonitoringMiddleware = module.toolMonitoringMiddleware;

    // Configure default mock behavior
    mockMessageFactory.toolUsage.mockReturnValue(defaultYieldPayload);

    // Recreate defaultRequest with fresh mockYieldMessage
    defaultRequest = {
      toolCall: defaultToolCall,
      runtime: {
        context: {
          userId: "user-1",
          campaignId: "campaign-1",
          threadId: "thread-1",
          runId: "run-1",
          yieldMessage: mockYieldMessage,
        },
      },
    };
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> toolMonitoringMiddleware creates middleware with correct name", () => {
    expect(toolMonitoringMiddleware.name).toBe("ToolMonitoringMiddleware");
  });

  test("Unit -> toolMonitoringMiddleware logs metric count on tool invocation", () => {
    const mockHandler = mock((_req) => "tool result");
    wrapToolCallFn(defaultRequest, mockHandler);

    expect(mockSentryMetrics.count).toHaveBeenCalledWith("tool_invocation", 1, {
      attributes: {
        tool_name: "calculator",
      },
    });
  });

  test("Unit -> toolMonitoringMiddleware logs debug info about tool execution", () => {
    const originalConsoleDebug = console.debug;
    const mockConsoleDebug = mock();
    console.debug = mockConsoleDebug;

    try {
      const mockHandler = mock((_req) => "tool result");
      wrapToolCallFn(defaultRequest, mockHandler);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Executing tool: calculator"
      );
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        'Arguments: {"expression":"2+2"}'
      );
    } finally {
      console.debug = originalConsoleDebug;
    }
  });

  test("Unit -> toolMonitoringMiddleware calls handler and returns result", () => {
    const mockHandler = mock((_req) => "tool result");
    const result = wrapToolCallFn(defaultRequest, mockHandler);

    expect(mockHandler).toHaveBeenCalledWith(defaultRequest);
    expect(result).toBe("tool result");
  });

  test("Unit -> toolMonitoringMiddleware captures exception on tool error", () => {
    const testError = new Error("Tool execution failed");
    const mockHandler = mock(() => {
      throw testError;
    });

    expect(() => wrapToolCallFn(defaultRequest, mockHandler)).toThrow(
      "Tool execution failed"
    );

    expect(mockSentryCaptureException).toHaveBeenCalledWith(testError, {
      extra: {
        toolName: "calculator",
        args: { expression: "2+2" },
      },
    });
  });

  test("Unit -> toolMonitoringMiddleware handles context with null value", () => {
    const requestWithNullContext = {
      toolCall: defaultToolCall,
      runtime: {
        context: null,
      },
    };

    const mockHandler = mock((_req) => "tool result");
    wrapToolCallFn(requestWithNullContext, mockHandler);

    expect(mockSentryMetrics.count).toHaveBeenCalledWith("tool_invocation", 1, {
      attributes: {
        tool_name: "calculator",
      },
    });
  });

  test("Unit -> toolMonitoringMiddleware handles context with undefined value", () => {
    const requestWithUndefinedContext = {
      toolCall: defaultToolCall,
      runtime: {
        context: undefined,
      },
    };

    const mockHandler = mock((_req) => "tool result");
    wrapToolCallFn(requestWithUndefinedContext, mockHandler);

    expect(mockSentryMetrics.count).toHaveBeenCalledWith("tool_invocation", 1, {
      attributes: {
        tool_name: "calculator",
      },
    });
  });

  test("Unit -> toolMonitoringMiddleware handles context with non-object value", () => {
    const requestWithPrimitiveContext = {
      toolCall: defaultToolCall,
      runtime: {
        context: "string-context",
      },
    };

    const mockHandler = mock((_req) => "tool result");

    // Should throw because string-context?.yieldMessage tries to call undefined as function
    expect(() =>
      wrapToolCallFn(requestWithPrimitiveContext, mockHandler)
    ).toThrow();

    expect(mockSentryMetrics.count).toHaveBeenCalledWith("tool_invocation", 1, {
      attributes: {
        tool_name: "calculator",
      },
    });
  });

  test("Unit -> toolMonitoringMiddleware handles tool with complex arguments", () => {
    const complexToolCall = {
      id: "call-2",
      name: "database_query",
      args: {
        table: "users",
        filters: {
          age: { $gte: 18 },
          status: "active",
        },
        select: ["id", "name", "email"],
      },
    };

    const requestWithComplexArgs = {
      toolCall: complexToolCall,
      runtime: {
        context: defaultRequest.runtime.context,
      },
    };

    const originalConsoleDebug = console.debug;
    const mockConsoleDebug = mock();
    console.debug = mockConsoleDebug;

    try {
      const mockHandler = mock((_req) => "query result");
      wrapToolCallFn(requestWithComplexArgs, mockHandler);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Executing tool: database_query"
      );
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining('"table":"users"')
      );
    } finally {
      console.debug = originalConsoleDebug;
    }
  });

  test("Unit -> toolMonitoringMiddleware re-throws error after capturing", () => {
    const testError = new Error("Critical tool failure");
    const mockHandler = mock(() => {
      throw testError;
    });

    let caughtError: Error | null = null;
    try {
      wrapToolCallFn(defaultRequest, mockHandler);
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBe(testError);
    expect(mockSentryCaptureException).toHaveBeenCalled();
  });

  test("Unit -> toolMonitoringMiddleware handles tool with no arguments", () => {
    const noArgsToolCall = {
      id: "call-3",
      name: "current_time",
      args: {},
    };

    const requestWithNoArgs = {
      toolCall: noArgsToolCall,
      runtime: {
        context: defaultRequest.runtime.context,
      },
    };

    const mockHandler = mock((_req) => "12:00 PM");
    const result = wrapToolCallFn(requestWithNoArgs, mockHandler);

    expect(result).toBe("12:00 PM");
    expect(mockSentryMetrics.count).toHaveBeenCalledWith(
      "tool_invocation",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          tool_name: "current_time",
        }),
      })
    );
  });

  test("Unit -> toolMonitoringMiddleware does not include context in metrics", () => {
    const partialContextRequest = {
      toolCall: defaultToolCall,
      runtime: {
        context: {
          userId: "user-1",
          campaignId: "campaign-1",
          yieldMessage: mockYieldMessage,
          // Missing threadId and runId
        },
      },
    };

    const mockHandler = mock((_req) => "tool result");
    wrapToolCallFn(partialContextRequest, mockHandler);

    // Only tool_name is included to keep cardinality low
    expect(mockSentryMetrics.count).toHaveBeenCalledWith("tool_invocation", 1, {
      attributes: {
        tool_name: "calculator",
      },
    });
  });

  test("Unit -> toolMonitoringMiddleware calls yieldMessage with tool usage when available", () => {
    const mockHandler = mock((_req) => "tool result");
    wrapToolCallFn(defaultRequest, mockHandler);

    expect(mockMessageFactory.toolUsage).toHaveBeenCalledWith(["calculator"]);
    expect(mockYieldMessage).toHaveBeenCalledWith(defaultYieldPayload);
  });

  test("Unit -> toolMonitoringMiddleware handles missing yieldMessage gracefully", () => {
    const requestWithoutYield = {
      toolCall: defaultToolCall,
      runtime: {
        context: null,
      },
    };

    const mockHandler = mock((_req) => "tool result");
    const result = wrapToolCallFn(requestWithoutYield, mockHandler);

    expect(result).toBe("tool result");
    expect(mockHandler).toHaveBeenCalledWith(requestWithoutYield);
    // Should not throw, just skip yielding
  });
});
