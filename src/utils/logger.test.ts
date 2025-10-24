import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("Logger", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockCaptureMessage: ReturnType<typeof mock>;
  let mockCaptureException: ReturnType<typeof mock>;
  let mockSentry: {
    captureMessage: ReturnType<typeof mock>;
    captureException: ReturnType<typeof mock>;
  };
  let logger: typeof import("./logger").logger;

  // Store original console methods
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleError: typeof console.error;
  let originalConsoleDebug: typeof console.debug;
  let originalNodeEnv: string | undefined;
  let originalSentryDsn: string | undefined;

  // Mock console methods
  let mockConsoleLog: ReturnType<typeof mock>;
  let mockConsoleWarn: ReturnType<typeof mock>;
  let mockConsoleError: ReturnType<typeof mock>;
  let mockConsoleDebug: ReturnType<typeof mock>;

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Store original console methods and environment
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleDebug = console.debug;
    originalNodeEnv = process.env.NODE_ENV;
    originalSentryDsn = process.env.SENTRY_DSN;

    // Create fresh mock instances for console
    mockConsoleLog = mock();
    mockConsoleWarn = mock();
    mockConsoleError = mock();
    mockConsoleDebug = mock();

    console.log = mockConsoleLog;
    console.warn = mockConsoleWarn;
    console.error = mockConsoleError;
    console.debug = mockConsoleDebug;

    // Create fresh mock instances for Sentry
    mockCaptureMessage = mock();
    mockCaptureException = mock();
    mockSentry = {
      captureMessage: mockCaptureMessage,
      captureException: mockCaptureException,
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("@sentry/bun", () => mockSentry);

    // Set default environment to development (no Sentry)
    process.env.NODE_ENV = "development";
    delete process.env.SENTRY_DSN;

    // Dynamically import the module under test
    const module = await import("./logger");
    logger = module.logger;
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;

    // Restore environment variables
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalSentryDsn !== undefined) {
      process.env.SENTRY_DSN = originalSentryDsn;
    } else {
      delete process.env.SENTRY_DSN;
    }

    // Clean up after each test
    mock.restore();
  });

  describe("logging methods", () => {
    test.each([
      {
        method: "info" as const,
        message: "Test info message",
        expectedPrefix: "INFO:",
        consoleMethod: () => mockConsoleLog,
        sentryMethod: () => mockCaptureMessage,
      },
      {
        method: "warn" as const,
        message: "Test warning",
        expectedPrefix: "WARN:",
        consoleMethod: () => mockConsoleWarn,
        sentryMethod: () => mockCaptureMessage,
      },
    ])(
      "Unit -> $method logs message to console with $expectedPrefix prefix",
      ({ method, message, expectedPrefix, consoleMethod }) => {
        logger[method](message);

        expect(consoleMethod()).toHaveBeenCalledWith(
          `${expectedPrefix} ${message}`
        );
      }
    );

    test.each([
      {
        method: "info" as const,
        message: "Test info",
        args: [{ key: "value" }, "extra"],
        expectedPrefix: "INFO:",
        consoleMethod: () => mockConsoleLog,
      },
      {
        method: "warn" as const,
        message: "Test warning",
        args: ["detail1", "detail2"],
        expectedPrefix: "WARN:",
        consoleMethod: () => mockConsoleWarn,
      },
    ])(
      "Unit -> $method logs message with additional arguments",
      ({ method, message, args, expectedPrefix, consoleMethod }) => {
        logger[method](message, ...args);

        expect(consoleMethod()).toHaveBeenCalledWith(
          `${expectedPrefix} ${message}`,
          ...args
        );
      }
    );

    test.each([
      {
        method: "info" as const,
        message: "Test info message",
        sentryMethod: () => mockCaptureMessage,
      },
      {
        method: "warn" as const,
        message: "Test warning",
        sentryMethod: () => mockCaptureMessage,
      },
    ])(
      "Unit -> $method does not call Sentry in development",
      ({ method, message, sentryMethod }) => {
        logger[method](message);

        expect(sentryMethod()).not.toHaveBeenCalled();
      }
    );
  });

  describe("error", () => {
    test("Unit -> error logs Error object to console in development", () => {
      const testError = new Error("Test error");
      logger.error("Error occurred", testError);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "ERROR: Error occurred",
        testError
      );
    });

    test("Unit -> error does not log to console in test environment", async () => {
      // Reconfigure for test environment
      process.env.NODE_ENV = "test";

      // Re-import to pick up new environment
      mock.restore();
      mockConsoleError = mock();
      console.error = mockConsoleError;
      mock.module("@sentry/bun", () => mockSentry);
      const module = await import("./logger");
      const testLogger = module.logger;

      const testError = new Error("Test error");
      testLogger.error("Error occurred", testError);

      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test("Unit -> error creates Error when no Error object provided", () => {
      logger.error("Error without object", "some data");

      expect(mockConsoleError).toHaveBeenCalled();
      const [, errorArg] = mockConsoleError.mock.calls[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toBe("Error without object");
    });

    test("Unit -> error handles additional arguments", () => {
      const testError = new Error("Test error");
      logger.error("Error occurred", testError, "extra1", "extra2");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "ERROR: Error occurred",
        testError,
        "extra1",
        "extra2"
      );
    });

    test("Unit -> error does not call Sentry in development", () => {
      const testError = new Error("Test error");
      logger.error("Error occurred", testError);

      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  describe("debug", () => {
    test.each([
      {
        message: "Debug message",
        args: [],
        description: "logs message in development",
      },
      {
        message: "Debug",
        args: ["arg1", 123],
        description: "logs message with arguments",
      },
    ])(
      "Unit -> debug $description",
      ({ message, args }: { message: string; args: unknown[] }) => {
        logger.debug(message, ...args);

        expect(mockConsoleDebug).toHaveBeenCalledWith(
          `DEBUG: ${message}`,
          ...args
        );
      }
    );

    test.each([
      { env: "production", description: "does not log in production" },
      { env: "test", description: "does not log in test environment" },
    ])("Unit -> debug $description", async ({ env }) => {
      // Reconfigure for different environment
      process.env.NODE_ENV = env;

      // Re-import to pick up new environment
      mock.restore();
      mockConsoleDebug = mock();
      console.debug = mockConsoleDebug;
      mock.module("@sentry/bun", () => mockSentry);
      const module = await import("./logger");
      const envLogger = module.logger;

      envLogger.debug("Debug message");

      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });
  });

  describe("success", () => {
    test.each([
      {
        message: "Operation completed",
        args: [],
        expectedOutput: "✓ SUCCESS: Operation completed",
      },
      {
        message: "Completed",
        args: ["detail"],
        expectedOutput: "✓ SUCCESS: Completed",
      },
    ])(
      "Unit -> success logs message to console",
      ({ message, args, expectedOutput }) => {
        logger.success(message, ...args);

        expect(mockConsoleLog).toHaveBeenCalledWith(expectedOutput, ...args);
      }
    );

    test("Unit -> success does not call Sentry in development", () => {
      logger.success("Success message");

      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });
  });
});
