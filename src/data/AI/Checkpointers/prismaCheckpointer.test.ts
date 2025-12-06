import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  ChannelVersions,
  CheckpointMetadata,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";
import { Checkpoint } from "@langchain/langgraph-checkpoint";

describe("PrismaCheckpointSaver Sentry Integration", () => {
  let PrismaCheckpointSaver: typeof import("./prismaCheckpointer").PrismaCheckpointSaver;
  let mockSentry: {
    captureException: ReturnType<typeof mock>;
  };
  let mockDBClient: {
    checkpoint: {
      findFirst: ReturnType<typeof mock>;
      findMany: ReturnType<typeof mock>;
      findUnique: ReturnType<typeof mock>;
      create: ReturnType<typeof mock>;
      update: ReturnType<typeof mock>;
      deleteMany: ReturnType<typeof mock>;
    };
  };

  // Default mock data
  const defaultThreadId = "user123:thread456:campaign789";
  const defaultCheckpointId = "checkpoint-uuid-123";
  const defaultCheckpoint: Checkpoint = {
    v: 1,
    id: defaultCheckpointId,
    ts: "2024-01-01T00:00:00.000Z",
    channel_values: {},
    channel_versions: {},
    versions_seen: {},
  };
  const defaultMetadata: CheckpointMetadata = {
    source: "input",
    step: 1,
    parents: {},
  };
  const defaultNewVersions: ChannelVersions = {
    messages: 1,
    state: 1,
  };

  beforeEach(async () => {
    mock.restore();

    // Create fresh mock instances
    const mockCaptureException = mock();
    mockSentry = {
      captureException: mockCaptureException,
    };

    const mockFindFirst = mock();
    const mockFindMany = mock();
    const mockFindUnique = mock();
    const mockCreate = mock();
    const mockUpdate = mock();
    const mockDeleteMany = mock();

    mockDBClient = {
      checkpoint: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        deleteMany: mockDeleteMany,
      },
    };

    // Set up module mocks
    mock.module("@sentry/bun", () => mockSentry);
    mock.module("../../MongoDB", () => ({
      DBClient: mockDBClient,
      Prisma: {
        InputJsonArray: {},
        InputJsonObject: {},
      },
    }));

    // Dynamically import the module under test
    const module = await import("./prismaCheckpointer");
    PrismaCheckpointSaver = module.PrismaCheckpointSaver;
  });

  afterEach(() => {
    mock.restore();
  });

  describe("getTuple", () => {
    test("Unit -> getTuple captures exception with context when database query fails", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database connection failed");
      mockDBClient.checkpoint.findFirst.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "",
        },
      };

      const result = await checkpointer.getTuple(config);

      expect(result).toBeUndefined();
      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointNamespace: "",
          checkpointId: undefined,
          operation: "getTuple",
          reminder:
            "Failed to retrieve checkpoint from database. This could indicate database connectivity issues, corrupted checkpoint data, or serialization problems.",
        },
      });
    });

    test("Unit -> getTuple captures exception with checkpoint ID when specified", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database error");
      mockDBClient.checkpoint.findFirst.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "custom-namespace",
          checkpoint_id: defaultCheckpointId,
        },
      };

      await checkpointer.getTuple(config);

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointNamespace: "custom-namespace",
          checkpointId: defaultCheckpointId,
          operation: "getTuple",
          reminder:
            "Failed to retrieve checkpoint from database. This could indicate database connectivity issues, corrupted checkpoint data, or serialization problems.",
        },
      });
    });
  });

  describe("list", () => {
    test("Unit -> list captures exception with context when database query fails", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database query failed");
      mockDBClient.checkpoint.findMany.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "",
        },
      };

      const generator = checkpointer.list(config, { limit: 10 });
      const results = [];
      for await (const item of generator) {
        results.push(item);
      }

      expect(results).toHaveLength(0);
      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointNamespace: "",
          limit: 10,
          operation: "list",
          reminder:
            "Failed to list checkpoints from database. This could indicate database connectivity issues, corrupted checkpoint data, or serialization problems affecting multiple checkpoints.",
        },
      });
    });

    test("Unit -> list captures exception without limit when not specified", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database error");
      mockDBClient.checkpoint.findMany.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "test-namespace",
        },
      };

      const generator = checkpointer.list(config);
      for await (const _ of generator) {
        // Iterator will be empty due to error
      }

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointNamespace: "test-namespace",
          limit: undefined,
          operation: "list",
          reminder:
            "Failed to list checkpoints from database. This could indicate database connectivity issues, corrupted checkpoint data, or serialization problems affecting multiple checkpoints.",
        },
      });
    });
  });

  describe("put", () => {
    test("Unit -> put successfully creates a checkpoint", async () => {
      const checkpointer = new PrismaCheckpointSaver();

      mockDBClient.checkpoint.create.mockResolvedValue({
        id: defaultCheckpointId,
      });

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "",
        },
      };

      const result = await checkpointer.put(
        config,
        defaultCheckpoint,
        defaultMetadata,
        defaultNewVersions
      );

      expect(result).toEqual({
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "",
          checkpoint_id: defaultCheckpointId,
        },
      });

      expect(mockDBClient.checkpoint.create).toHaveBeenCalledWith({
        data: {
          id: defaultCheckpointId,
          threadId: defaultThreadId,
          checkpointNamespace: "",
          checkpointData: expect.any(Array),
          metadata: defaultMetadata,
          parentCheckpointId: undefined,
        },
      });
    });

    test("Unit -> put successfully creates a checkpoint with parent ID", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const parentId = "parent-123";

      mockDBClient.checkpoint.create.mockResolvedValue({
        id: defaultCheckpointId,
      });

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "test-ns",
          checkpoint_id: parentId,
        },
      };

      const result = await checkpointer.put(
        config,
        defaultCheckpoint,
        defaultMetadata,
        defaultNewVersions
      );

      expect(result).toEqual({
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "test-ns",
          checkpoint_id: defaultCheckpointId,
        },
      });

      expect(mockDBClient.checkpoint.create).toHaveBeenCalledWith({
        data: {
          id: defaultCheckpointId,
          threadId: defaultThreadId,
          checkpointNamespace: "test-ns",
          checkpointData: expect.any(Array),
          metadata: defaultMetadata,
          parentCheckpointId: parentId,
        },
      });
    });
    test("Unit -> put captures exception with full context when database create fails", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database insert failed");
      mockDBClient.checkpoint.create.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "",
          checkpoint_id: "parent-checkpoint-id",
        },
      };

      await expect(
        checkpointer.put(
          config,
          defaultCheckpoint,
          defaultMetadata,
          defaultNewVersions
        )
      ).rejects.toThrow("Database insert failed");

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointNamespace: "",
          checkpointId: defaultCheckpointId,
          parentCheckpointId: "parent-checkpoint-id",
          userId: "user123",
          campaignThreadId: "thread456",
          campaignId: "campaign789",
          operation: "put",
          reminder:
            "Failed to save checkpoint to database. This is a critical operation that prevents conversation state from being persisted. Could indicate database connectivity issues, serialization failures, or invalid checkpoint data.",
        },
      });
    });

    test("Unit -> put captures exception without parent checkpoint ID when not specified", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database error");
      mockDBClient.checkpoint.create.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_ns: "custom-ns",
        },
      };

      await expect(
        checkpointer.put(
          config,
          defaultCheckpoint,
          defaultMetadata,
          defaultNewVersions
        )
      ).rejects.toThrow();

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointNamespace: "custom-ns",
          checkpointId: defaultCheckpointId,
          parentCheckpointId: undefined,
          userId: "user123",
          campaignThreadId: "thread456",
          campaignId: "campaign789",
          operation: "put",
          reminder:
            "Failed to save checkpoint to database. This is a critical operation that prevents conversation state from being persisted. Could indicate database connectivity issues, serialization failures, or invalid checkpoint data.",
        },
      });
    });
  });

  describe("putWrites", () => {
    test("Unit -> putWrites captures exception with context when database update fails", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database update failed");

      // Mock findUnique to return a checkpoint
      mockDBClient.checkpoint.findUnique.mockResolvedValue({
        id: defaultCheckpointId,
        metadata: {},
      });

      // Mock update to fail
      mockDBClient.checkpoint.update.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_id: defaultCheckpointId,
        },
      };

      const writes: PendingWrite[] = [
        ["output", "test value"],
        ["state", { foo: "bar" }],
      ];

      // Should not throw despite the error
      await checkpointer.putWrites(config, writes, "task-123");

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointId: defaultCheckpointId,
          taskId: "task-123",
          writesCount: 2,
          operation: "putWrites",
          reminder:
            "Failed to save pending writes to checkpoint. This is non-critical but means partial AI execution results may be lost. Could indicate database issues or that the checkpoint doesn't exist yet (which is normal if putWrites is called before put).",
        },
      });
    });

    test("Unit -> putWrites captures exception when checkpoint lookup fails", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database lookup failed");
      mockDBClient.checkpoint.findUnique.mockRejectedValue(testError);

      const config = {
        configurable: {
          thread_id: defaultThreadId,
          checkpoint_id: defaultCheckpointId,
        },
      };

      const writes: PendingWrite[] = [["output", "test"]];

      await checkpointer.putWrites(config, writes, "task-456");

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          checkpointId: defaultCheckpointId,
          taskId: "task-456",
          writesCount: 1,
          operation: "putWrites",
          reminder:
            "Failed to save pending writes to checkpoint. This is non-critical but means partial AI execution results may be lost. Could indicate database issues or that the checkpoint doesn't exist yet (which is normal if putWrites is called before put).",
        },
      });
    });
  });

  describe("deleteThread", () => {
    test("Unit -> deleteThread captures exception with context when database delete fails", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Database delete failed");
      mockDBClient.checkpoint.deleteMany.mockRejectedValue(testError);

      await expect(checkpointer.deleteThread(defaultThreadId)).rejects.toThrow(
        "Database delete failed"
      );

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: defaultThreadId,
          operation: "deleteThread",
          reminder:
            "Failed to delete checkpoints for thread. This could leave orphaned checkpoint data in the database. Could indicate database connectivity issues or permission problems.",
        },
      });
    });

    test("Unit -> deleteThread captures exception with different thread ID format", async () => {
      const checkpointer = new PrismaCheckpointSaver();
      const testError = new Error("Permission denied");
      mockDBClient.checkpoint.deleteMany.mockRejectedValue(testError);

      const customThreadId = "userABC:threadXYZ:campaignDEF";

      await expect(checkpointer.deleteThread(customThreadId)).rejects.toThrow(
        "Permission denied"
      );

      expect(mockSentry.captureException).toHaveBeenCalledWith(testError, {
        extra: {
          threadId: customThreadId,
          operation: "deleteThread",
          reminder:
            "Failed to delete checkpoints for thread. This could leave orphaned checkpoint data in the database. Could indicate database connectivity issues or permission problems.",
        },
      });
    });
  });
});
