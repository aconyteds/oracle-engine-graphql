import { test, expect, beforeEach, mock, describe, afterAll } from "bun:test";
import type { Message, MessageWorkspace } from "@prisma/client";

const mockFindUniqueOrThrow = mock();
const mockUpdate = mock();

mock.module("./client", () => ({
  DBClient: {
    message: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUpdate,
    },
  },
}));
import { addMessageWorkspaceEntry } from "./addMessageWorkspaceEntry";

describe("addMessageWorkspaceEntry", () => {
  beforeEach(() => {
    mockFindUniqueOrThrow.mockClear();
    mockUpdate.mockClear();
  });

  afterAll(() => {
    mock.restore();
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
});
