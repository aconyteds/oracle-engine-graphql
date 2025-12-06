import type { RunnableConfig } from "@langchain/core/runnables";
import type {
  CheckpointMetadata,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";
import {
  BaseCheckpointSaver,
  type ChannelVersions,
  Checkpoint,
  CheckpointListOptions,
  CheckpointTuple,
} from "@langchain/langgraph-checkpoint";
import * as Sentry from "@sentry/bun";
import { DBClient, Prisma } from "../../MongoDB";

/**
 * Converts binary data (Uint8Array) to a text-based Base64 string.
 * This is necessary because MongoDB stores data as strings or JSON,
 * not raw binary data. Think of it like converting a file to a text format
 * so it can be safely stored in a database.
 *
 * @param uint8Array - The binary data to convert
 * @returns A Base64 string representation of the binary data
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  return Buffer.from(uint8Array).toString("base64");
}

/**
 * Converts a Base64 string back into binary data (Uint8Array).
 * This reverses the encoding process so we can use the original binary data again.
 *
 * @param base64 - The Base64 string to convert back to binary
 * @returns The original binary data as a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * A Checkpointer saves the state of AI agent conversations to a database.
 *
 * Think of a checkpointer like a "save game" feature in a video game:
 * - It saves the current state of a conversation with an AI agent
 * - You can load a previous state to continue from where you left off
 * - You can see the history of all saved states
 * - You can delete old saves when you don't need them anymore
 *
 * Why is this useful?
 * - **Memory**: The AI can remember what happened in previous conversations
 * - **Recovery**: If something crashes, you don't lose the conversation progress
 * - **Branching**: You can explore different conversation paths from the same starting point
 * - **Debugging**: Developers can inspect exactly what the AI was "thinking" at any point
 *
 * This specific implementation uses Prisma (a database tool) to store checkpoints
 * in MongoDB. Each checkpoint contains:
 * - The conversation state (what the AI knows at this point)
 * - Metadata (like timestamps, who created it, etc.)
 * - Links to previous checkpoints (so we can trace the conversation history)
 *
 * @example
 * ```typescript
 * const checkpointer = new PrismaCheckpointSaver();
 *
 * // Save the current state
 * await checkpointer.put(config, checkpoint, metadata);
 *
 * // Load the most recent state
 * const tuple = await checkpointer.getTuple(config);
 *
 * // Get all saved states for this conversation
 * for await (const checkpoint of checkpointer.list(config)) {
 *   console.log(checkpoint);
 * }
 * ```
 */
export class PrismaCheckpointSaver extends BaseCheckpointSaver {
  /**
   * Retrieves a specific saved checkpoint (conversation state) from the database.
   *
   * This is like loading a save game - it fetches the most recent state of a conversation
   * (or a specific checkpoint if you provide a checkpoint ID).
   *
   * The method looks up the checkpoint by:
   * - `thread_id`: Which conversation thread this belongs to (format: "userId:threadId:campaignId")
   * - `checkpoint_ns`: A namespace to organize checkpoints (like a folder name)
   * - `checkpoint_id` (optional): The ID of a specific checkpoint to retrieve
   *
   * @param config - Configuration object that identifies which checkpoint to retrieve
   * @param config.configurable.thread_id - The ID of the conversation thread
   * @param config.configurable.checkpoint_ns - The namespace for organizing checkpoints (defaults to "")
   * @param config.configurable.checkpoint_id - (Optional) Specific checkpoint ID to retrieve
   * @returns A CheckpointTuple containing the checkpoint data, metadata, and parent references,
   *          or undefined if no checkpoint is found
   *
   * @example
   * ```typescript
   * const config = {
   *   configurable: {
   *     thread_id: "user123:thread456:campaign789",
   *     checkpoint_ns: "",
   *   }
   * };
   *
   * const tuple = await checkpointer.getTuple(config);
   * if (tuple) {
   *   console.log("Found checkpoint:", tuple.checkpoint);
   *   console.log("Created at:", tuple.metadata);
   * }
   * ```
   */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointNamespace =
      (config.configurable?.checkpoint_ns as string) ?? "";
    const checkpointId = config.configurable?.checkpoint_id as
      | string
      | undefined;

    if (!threadId) {
      return undefined;
    }

    try {
      // Find the most recent checkpoint for this thread
      const checkpointDoc = await DBClient.checkpoint.findFirst({
        where: {
          threadId,
          checkpointNamespace,
          ...(checkpointId ? { id: checkpointId } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!checkpointDoc) {
        return undefined;
      }

      // Deserialize checkpoint data
      // dumpsTyped returns [type: string, data: Uint8Array], stored as [type, base64]
      const checkpointData = checkpointDoc.checkpointData as unknown;
      if (!Array.isArray(checkpointData) || checkpointData.length !== 2) {
        console.error("Invalid checkpoint data format");
        return undefined;
      }

      const [type, base64Data] = checkpointData as [string, string];
      const data = base64ToUint8Array(base64Data);
      const checkpoint = (await this.serde.loadsTyped(
        type,
        data
      )) as Checkpoint;

      if (!checkpoint) {
        return undefined;
      }

      // Parse metadata
      const metadata = checkpointDoc.metadata as CheckpointMetadata;

      // Build config for this checkpoint
      const checkpointConfig: RunnableConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: checkpointDoc.id,
        },
      };

      // Get parent config if exists
      let parentConfig: RunnableConfig | undefined;
      if (checkpointDoc.parentCheckpointId) {
        const parentDoc = await DBClient.checkpoint.findUnique({
          where: { id: checkpointDoc.parentCheckpointId },
        });

        if (parentDoc) {
          parentConfig = {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointNamespace,
              checkpoint_id: parentDoc.id,
            },
          };
        }
      }

      return {
        config: checkpointConfig,
        checkpoint,
        metadata,
        parentConfig,
        pendingWrites: [],
      };
    } catch (error) {
      console.error("Error retrieving checkpoint:", error);
      Sentry.captureException(error, {
        extra: {
          threadId,
          checkpointNamespace,
          checkpointId,
          operation: "getTuple",
          reminder:
            "Failed to retrieve checkpoint from database. This could indicate database connectivity issues, corrupted checkpoint data, or serialization problems.",
        },
      });
      return undefined;
    }
  }

  /**
   * Lists all saved checkpoints for a conversation thread in reverse chronological order
   * (newest first, like viewing your browser history from most recent to oldest).
   *
   * This is an async generator function, which means it yields results one at a time
   * rather than loading everything into memory at once. This is efficient when dealing
   * with conversations that have many checkpoints.
   *
   * Use this when you want to:
   * - See the full history of a conversation
   * - Find a specific checkpoint in the past
   * - Debug what happened at different points in the conversation
   *
   * @param config - Configuration object that identifies which thread's checkpoints to list
   * @param config.configurable.thread_id - The ID of the conversation thread
   * @param config.configurable.checkpoint_ns - The namespace for organizing checkpoints (defaults to "")
   * @param options - Optional settings to control the listing
   * @param options.limit - Maximum number of checkpoints to return
   * @yields CheckpointTuple objects, one at a time, in reverse chronological order
   *
   * @example
   * ```typescript
   * const config = {
   *   configurable: {
   *     thread_id: "user123:thread456:campaign789",
   *   }
   * };
   *
   * // Get the 10 most recent checkpoints
   * for await (const tuple of checkpointer.list(config, { limit: 10 })) {
   *   console.log("Checkpoint ID:", tuple.config.configurable?.checkpoint_id);
   *   console.log("Created at:", tuple.metadata);
   * }
   * ```
   */
  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointNamespace =
      (config.configurable?.checkpoint_ns as string) ?? "";

    if (!threadId) {
      return;
    }

    try {
      const checkpoints = await DBClient.checkpoint.findMany({
        where: {
          threadId,
          checkpointNamespace,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: options?.limit,
      });

      for (const checkpointDoc of checkpoints) {
        const checkpointData = checkpointDoc.checkpointData as unknown;
        if (!Array.isArray(checkpointData) || checkpointData.length !== 2) {
          console.error("Invalid checkpoint data format");
          continue;
        }

        const [type, base64Data] = checkpointData as [string, string];
        const data = base64ToUint8Array(base64Data);
        const checkpoint = (await this.serde.loadsTyped(
          type,
          data
        )) as Checkpoint;

        if (!checkpoint) {
          continue;
        }

        const metadata = checkpointDoc.metadata as CheckpointMetadata;

        const checkpointConfig: RunnableConfig = {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNamespace,
            checkpoint_id: checkpointDoc.id,
          },
        };

        let parentConfig: RunnableConfig | undefined;
        if (checkpointDoc.parentCheckpointId) {
          const parentDoc = await DBClient.checkpoint.findUnique({
            where: { id: checkpointDoc.parentCheckpointId },
          });

          if (parentDoc) {
            parentConfig = {
              configurable: {
                thread_id: threadId,
                checkpoint_ns: checkpointNamespace,
                checkpoint_id: parentDoc.id,
              },
            };
          }
        }

        yield {
          config: checkpointConfig,
          checkpoint,
          metadata,
          parentConfig,
          pendingWrites: [],
        };
      }
    } catch (error) {
      console.error("Error listing checkpoints:", error);
      Sentry.captureException(error, {
        extra: {
          threadId,
          checkpointNamespace,
          limit: options?.limit,
          operation: "list",
          reminder:
            "Failed to list checkpoints from database. This could indicate database connectivity issues, corrupted checkpoint data, or serialization problems affecting multiple checkpoints.",
        },
      });
    }
  }

  /**
   * Saves a new checkpoint (conversation state) to the database.
   *
   * This is like creating a save point in a video game. It stores the current state
   * of the AI conversation so it can be resumed later. Each checkpoint is linked to
   * its parent checkpoint, creating a chain of conversation history.
   *
   * The method:
   * 1. Extracts the thread information from the config (userId, threadId, campaignId)
   * 2. Serializes the checkpoint data into a format that can be stored in MongoDB
   * 3. Saves it to the database with metadata and parent checkpoint reference
   * 4. Returns a config object that includes the new checkpoint's ID
   *
   * @param config - Configuration that identifies which thread this checkpoint belongs to
   * @param config.configurable.thread_id - Required. Format: "userId:threadId:campaignId"
   * @param config.configurable.checkpoint_ns - The namespace for organizing checkpoints (defaults to "")
   * @param config.configurable.checkpoint_id - The parent checkpoint ID (if this is continuing from a previous state)
   * @param checkpoint - The checkpoint data to save (the actual conversation state)
   * @param metadata - Additional information about this checkpoint (timestamps, source, etc.)
   * @param newVersions - Channel versions for this checkpoint (used by LangGraph for version tracking)
   * @returns A new config object with the saved checkpoint's ID
   * @throws Error if thread_id is missing or in an invalid format
   *
   * @example
   * ```typescript
   * const config = {
   *   configurable: {
   *     thread_id: "user123:thread456:campaign789",
   *     checkpoint_ns: "",
   *   }
   * };
   *
   * const newVersions = { messages: 1, state: 1 };
   * const newConfig = await checkpointer.put(config, checkpoint, metadata, newVersions);
   * console.log("Saved checkpoint ID:", newConfig.configurable?.checkpoint_id);
   * ```
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointNamespace =
      (config.configurable?.checkpoint_ns as string) ?? "";

    // Note: newVersions parameter is required by BaseCheckpointSaver interface
    // but not currently used in this implementation. The checkpoint object already
    // contains channel_versions which tracks the versions. If version tracking
    // beyond what's in the checkpoint is needed, newVersions could be stored
    // in the metadata or as a separate field in the database schema.

    if (!threadId) {
      throw new Error(
        "Failed to put checkpoint. The passed RunnableConfig is missing a required 'thread_id' field in its 'configurable' property."
      );
    }

    // Extract IDs from threadId (format: "userId:threadId:campaignId")
    const [userId, campaignThreadId, campaignId] = threadId.split(":");

    if (!userId || !campaignThreadId || !campaignId) {
      throw new Error(
        `Invalid thread_id format. Expected 'userId:threadId:campaignId', got '${threadId}'`
      );
    }

    // Serialize checkpoint (dumpsTyped is async!)
    const serialized = await this.serde.dumpsTyped(checkpoint);

    // Validate serialization result
    if (!Array.isArray(serialized) || serialized.length !== 2) {
      console.error("Invalid serialization result:", serialized);
      console.error("Checkpoint:", JSON.stringify(checkpoint, null, 2));
      throw new Error("Failed to serialize checkpoint");
    }

    const [type, data] = serialized;

    // Convert Uint8Array to base64 for MongoDB storage
    const base64Data = uint8ArrayToBase64(data);
    const checkpointData = [type, base64Data];

    // Get parent checkpoint ID if exists
    const parentCheckpointId = config.configurable?.checkpoint_id as
      | string
      | undefined;

    // LangGraph generates its own checkpoint IDs (UUIDs)
    // We need to use the checkpoint.id as the document ID
    const checkpointId = checkpoint.id;

    try {
      // Create new checkpoint with explicit ID from LangGraph
      const checkpointDoc = await DBClient.checkpoint.create({
        data: {
          id: checkpointId,
          threadId,
          checkpointNamespace,
          checkpointData: checkpointData as Prisma.InputJsonArray,
          metadata: metadata as Prisma.InputJsonObject,
          parentCheckpointId,
        },
      });

      // Return config with new checkpoint ID
      return {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: checkpointDoc.id,
        },
      };
    } catch (error) {
      console.error("Error saving checkpoint:", error);
      Sentry.captureException(error, {
        extra: {
          threadId,
          checkpointNamespace,
          checkpointId: checkpoint.id,
          parentCheckpointId,
          userId,
          campaignThreadId,
          campaignId,
          operation: "put",
          reminder:
            "Failed to save checkpoint to database. This is a critical operation that prevents conversation state from being persisted. Could indicate database connectivity issues, serialization failures, or invalid checkpoint data.",
        },
      });
      throw error;
    }
  }

  /**
   * Stores intermediate "writes" (partial updates) that are associated with a checkpoint.
   *
   * Think of this like autosave in a document editor: while the AI is thinking and
   * generating a response, it might produce partial results. These are the "writes".
   * We store them so we can see what the AI was working on, even if it hasn't
   * finished the complete response yet.
   *
   * Why store partial results?
   * - **Recovery**: If the AI crashes mid-response, we don't lose the work it did
   * - **Streaming**: We can show partial results to the user while the AI is still thinking
   * - **Debugging**: We can see exactly what steps the AI took and in what order
   *
   * Important note: This method can be called BEFORE the checkpoint exists (putWrites
   * might be called before put()). This is normal - LangGraph will call putWrites again
   * after the checkpoint is created.
   *
   * Current implementation stores writes in the checkpoint's metadata. If you need to
   * store many writes or very large writes, this could be extended to use a separate
   * database collection.
   *
   * @param config - Configuration that identifies which checkpoint these writes belong to
   * @param config.configurable.thread_id - Required. The conversation thread ID
   * @param config.configurable.checkpoint_id - Required. The checkpoint ID these writes belong to
   * @param writes - An array of partial updates/results to store
   * @param taskId - A unique identifier for the task that created these writes
   * @throws Error if thread_id or checkpoint_id is missing
   *
   * @example
   * ```typescript
   * const config = {
   *   configurable: {
   *     thread_id: "user123:thread456:campaign789",
   *     checkpoint_id: "ckpt-uuid-here",
   *   }
   * };
   *
   * const writes = [
   *   { channel: "output", value: "Partial response..." }
   * ];
   *
   * await checkpointer.putWrites(config, writes, "task-123");
   * ```
   */
  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointId = config.configurable?.checkpoint_id as
      | string
      | undefined;

    if (!threadId) {
      throw new Error(
        "Failed to put writes. The passed RunnableConfig is missing a required 'thread_id' field in its 'configurable' property"
      );
    }

    if (!checkpointId) {
      throw new Error(
        "Failed to put writes. The passed RunnableConfig is missing a 'checkpoint_id' field in its 'configurable' property"
      );
    }

    try {
      // putWrites can be called before put(), so the checkpoint may not exist yet
      // We'll store the writes and they'll be picked up when the checkpoint is retrieved
      const checkpointDoc = await DBClient.checkpoint.findUnique({
        where: { id: checkpointId },
      });

      if (checkpointDoc) {
        // Checkpoint exists, update its metadata with writes
        const metadata = checkpointDoc.metadata as Record<string, unknown>;
        const updatedMetadata = {
          ...metadata,
          writes: {
            ...((metadata.writes as Record<string, unknown>) || {}),
            [taskId]: writes,
          },
        };

        await DBClient.checkpoint.update({
          where: { id: checkpointId },
          data: { metadata: updatedMetadata as Prisma.InputJsonObject },
        });
      }
      // If checkpoint doesn't exist yet, putWrites is being called before put()
      // This is normal - the checkpoint will be created soon and won't have these writes
      // LangGraph will call putWrites again after the checkpoint is created
    } catch (error) {
      console.error("Error saving writes:", error);
      Sentry.captureException(error, {
        extra: {
          threadId,
          checkpointId,
          taskId,
          writesCount: writes.length,
          operation: "putWrites",
          reminder:
            "Failed to save pending writes to checkpoint. This is non-critical but means partial AI execution results may be lost. Could indicate database issues or that the checkpoint doesn't exist yet (which is normal if putWrites is called before put).",
        },
      });
      // Don't throw - putWrites failures shouldn't break the flow
    }
  }

  /**
   * Deletes all checkpoints for a specific conversation thread.
   *
   * This is like deleting a save game file - it removes all saved states for a
   * conversation. Use this when:
   * - A user deletes a conversation thread
   * - You need to free up database space
   * - You're starting a completely fresh conversation with no history
   *
   * ⚠️ Warning: This operation cannot be undone! All conversation history for
   * this thread will be permanently deleted.
   *
   * @param threadId - The ID of the thread whose checkpoints should be deleted
   * @throws Error if the database operation fails
   *
   * @example
   * ```typescript
   * // Delete all checkpoints for a specific thread
   * await checkpointer.deleteThread("user123:thread456:campaign789");
   * console.log("All checkpoints for this thread have been deleted");
   * ```
   */
  async deleteThread(threadId: string): Promise<void> {
    try {
      await DBClient.checkpoint.deleteMany({
        where: { threadId },
      });
    } catch (error) {
      console.error("Error deleting thread checkpoints:", error);
      Sentry.captureException(error, {
        extra: {
          threadId,
          operation: "deleteThread",
          reminder:
            "Failed to delete checkpoints for thread. This could leave orphaned checkpoint data in the database. Could indicate database connectivity issues or permission problems.",
        },
      });
      throw error;
    }
  }
}
