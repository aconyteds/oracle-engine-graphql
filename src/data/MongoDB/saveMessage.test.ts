import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Message, MessageWorkspace } from "@prisma/client";
import { saveMessage } from "./saveMessage";

describe("saveMessage", () => {
  // Mock dependencies - recreated for each test
  let mockCreate: ReturnType<typeof mock>;
  let mockThreadUpdate: ReturnType<typeof mock>;
  let mockCalculateTokenCount: ReturnType<typeof mock>;

  const defaultMockMessage: Message = {
    id: "default-message-id",
    content: "Default message content",
    threadId: "default-thread-id",
    role: "user",
    tokenCount: 20,
    workspace: [],
    runId: null,
    routingMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Restore all mocks before each test
    mock.restore();

    // Create fresh mock objects
    mockCreate = mock();
    mockThreadUpdate = mock();
    mockCalculateTokenCount = mock();

    // Set up module mocks
    // Import Prisma types to re-export them
    const prismaTypes = await import("@prisma/client");
    mock.module("./client", () => ({
      ...prismaTypes,
      DBClient: {
        message: {
          create: mockCreate,
        },
        thread: {
          update: mockThreadUpdate,
        },
      },
    }));

    mock.module("../AI/calculateTokenCount", () => ({
      calculateTokenCount: mockCalculateTokenCount,
    }));

    // Configure default mock behavior
    mockCalculateTokenCount.mockReturnValue(10);
    mockCreate.mockResolvedValue(defaultMockMessage);
    mockThreadUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    // Restore mocks after each test for complete isolation
    mock.restore();
  });
  // Failing in CI but not locally - investigating
  test("Unit -> saveMessage creates message with required fields", async () => {
    mockCalculateTokenCount.mockReturnValue(50);

    const result = await saveMessage({
      threadId: "test-thread-id",
      content: "Test message content",
      role: "user",
    });

    expect(mockCalculateTokenCount).toHaveBeenCalledWith(
      "Test message content"
    );
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        content: "Test message content",
        threadId: "test-thread-id",
        role: "user",
        tokenCount: 50,
        workspace: [],
        runId: null,
        routingMetadata: null,
      },
    });
    expect(mockThreadUpdate).toHaveBeenCalledWith({
      where: { id: "test-thread-id" },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: { updatedAt: expect.any(Date) },
    });
    expect(result).toEqual(defaultMockMessage);
  });
  // Failing in CI but not locally - investigating
  test("Unit -> saveMessage creates message with workspace and runId", async () => {
    const mockWorkspace: MessageWorkspace[] = [
      {
        messageType: "tool_call",
        content: "Tool execution result",
        timestamp: new Date(),
        elapsedTime: 1000,
      },
    ];

    const mockMessage: Message = {
      id: "test-message-id",
      content: "Test message with workspace",
      threadId: "test-thread-id",
      role: "assistant",
      tokenCount: 75,
      workspace: mockWorkspace,
      runId: "run-123",
      routingMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCalculateTokenCount.mockReturnValue(75);
    mockCreate.mockResolvedValue(mockMessage);
    mockThreadUpdate.mockResolvedValue({});

    const result = await saveMessage({
      threadId: "test-thread-id",
      content: "Test message with workspace",
      role: "assistant",
      workspace: mockWorkspace,
      runId: "run-123",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        content: "Test message with workspace",
        threadId: "test-thread-id",
        role: "assistant",
        tokenCount: 75,
        workspace: mockWorkspace,
        runId: "run-123",
        routingMetadata: null,
      },
    });
    expect(result).toEqual(mockMessage);
  });
  // Failing in CI but not locally - investigating
  test("Unit -> saveMessage handles system role messages", async () => {
    const mockMessage: Message = {
      id: "system-message-id",
      content: "System instruction",
      threadId: "test-thread-id",
      role: "system",
      tokenCount: 25,
      workspace: [],
      runId: null,
      routingMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCalculateTokenCount.mockReturnValue(25);
    mockCreate.mockResolvedValue(mockMessage);
    mockThreadUpdate.mockResolvedValue({});

    const result = await saveMessage({
      threadId: "test-thread-id",
      content: "System instruction",
      role: "system",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        content: "System instruction",
        threadId: "test-thread-id",
        role: "system",
        tokenCount: 25,
        workspace: [],
        runId: null,
        routingMetadata: null,
      },
    });
    expect(result).toEqual(mockMessage);
  });
});
