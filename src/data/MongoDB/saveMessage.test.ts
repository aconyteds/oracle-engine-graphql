import { test, expect, beforeEach, mock, describe } from "bun:test";
import type { Message, MessageWorkspace } from "@prisma/client";

const mockCreate = mock();
const mockFindUniqueOrThrow = mock();
const mockUpdate = mock();
const mockThreadUpdate = mock();
const mockCalculateTokenCount = mock();

// Set up mocks before importing the module under test
mock.module("./client", () => ({
  DBClient: {
    message: {
      create: mockCreate,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUpdate,
    },
    thread: {
      update: mockThreadUpdate,
    },
  },
}));

mock.module("../AI", () => ({
  calculateTokenCount: mockCalculateTokenCount,
}));

import { saveMessage } from "./saveMessage";

describe("saveMessage", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockFindUniqueOrThrow.mockClear();
    mockUpdate.mockClear();
    mockThreadUpdate.mockClear();
    mockCalculateTokenCount.mockClear();
  });
  // Failing in CI but not locally - investigating
  test("Unit -> saveMessage creates message with required fields", async () => {
    const mockMessage: Message = {
      id: "test-message-id",
      content: "Test message content",
      threadId: "test-thread-id",
      role: "user",
      tokenCount: 50,
      workspace: [],
      runId: null,
      routingMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCalculateTokenCount.mockReturnValue(50);
    mockCreate.mockResolvedValue(mockMessage);
    mockThreadUpdate.mockResolvedValue({});

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
    expect(result).toEqual(mockMessage);
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
