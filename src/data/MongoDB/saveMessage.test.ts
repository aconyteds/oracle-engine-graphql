import { test, expect, beforeEach, mock } from "bun:test";
import type { Message, MessageWorkspace } from "./client";

const mockCreate = mock();
const mockFindUniqueOrThrow = mock();
const mockUpdate = mock();
const mockThreadUpdate = mock();
const mockCalculateTokenCount = mock();

// Set up mocks before importing the module under test
void mock.module("./client", () => ({
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

void mock.module("../AI", () => ({
  calculateTokenCount: mockCalculateTokenCount,
}));

import { saveMessage, addMessageWorkspaceEntry } from "./saveMessage";

beforeEach(() => {
  mockCreate.mockClear();
  mockFindUniqueOrThrow.mockClear();
  mockUpdate.mockClear();
  mockThreadUpdate.mockClear();
  mockCalculateTokenCount.mockClear();
});

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

  expect(mockCalculateTokenCount).toHaveBeenCalledWith("Test message content");
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

test("Unit -> addMessageWorkspaceEntry adds workspace entry to existing message", async () => {
  const existingWorkspace: MessageWorkspace[] = [
    {
      messageType: "reasoning",
      content: "Initial thought process",
      timestamp: new Date(),
      elapsedTime: null,
    },
  ];

  const existingMessage: Message = {
    id: "existing-message-id",
    content: "Existing message",
    threadId: "test-thread-id",
    role: "assistant",
    tokenCount: 40,
    workspace: existingWorkspace,
    runId: "run-456",
    routingMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const newWorkspaceEntry: MessageWorkspace = {
    messageType: "tool_call",
    content: "Calculator result: 42",
    timestamp: new Date(),
    elapsedTime: 500,
  };

  const updatedMessage: Message = {
    ...existingMessage,
    workspace: [...existingWorkspace, newWorkspaceEntry],
    updatedAt: new Date(),
  };

  mockFindUniqueOrThrow.mockResolvedValue(existingMessage);
  mockUpdate.mockResolvedValue(updatedMessage);

  const result = await addMessageWorkspaceEntry(
    "existing-message-id",
    newWorkspaceEntry
  );

  expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
    where: { id: "existing-message-id" },
  });
  expect(mockUpdate).toHaveBeenCalledWith({
    where: { id: "existing-message-id" },
    data: {
      workspace: [...existingWorkspace, newWorkspaceEntry],
    },
  });
  expect(result).toEqual(updatedMessage);
});

test("Unit -> addMessageWorkspaceEntry handles message with empty workspace", async () => {
  const existingMessage: Message = {
    id: "empty-workspace-message-id",
    content: "Message with empty workspace",
    threadId: "test-thread-id",
    role: "assistant",
    tokenCount: 35,
    workspace: [],
    runId: null,
    routingMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const newWorkspaceEntry: MessageWorkspace = {
    messageType: "tool_execution",
    content: "Dice roll result: 6",
    timestamp: new Date(),
    elapsedTime: 250,
  };

  const updatedMessage: Message = {
    ...existingMessage,
    workspace: [newWorkspaceEntry],
    updatedAt: new Date(),
  };

  mockFindUniqueOrThrow.mockResolvedValue(existingMessage);
  mockUpdate.mockResolvedValue(updatedMessage);

  const result = await addMessageWorkspaceEntry(
    "empty-workspace-message-id",
    newWorkspaceEntry
  );

  expect(mockUpdate).toHaveBeenCalledWith({
    where: { id: "empty-workspace-message-id" },
    data: {
      workspace: [newWorkspaceEntry],
    },
  });
  expect(result).toEqual(updatedMessage);
});
