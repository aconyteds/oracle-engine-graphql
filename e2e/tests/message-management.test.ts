import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "http";
import { setupTestServer, teardownTestServer } from "../setup";
import { MessageManagementWorkflow } from "../workflows/MessageManagementWorkflow";

describe("E2E -> Message Management Workflow", () => {
  let server: Server;

  beforeAll(async () => {
    server = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer(server);
  });

  test("Complete message lifecycle: create threads, add messages, verify cleanup", async () => {
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    const workflow = new MessageManagementWorkflow(
      server,
      testEmail,
      testPassword
    );
    const result = await workflow.execute();

    // Assert workflow succeeded
    expect(result.success).toBe(true);
    expect(result.failedNode).toBeUndefined();
    expect(result.error).toBeUndefined();

    // Assert all nodes executed
    // Workflow: Login → CreateCampaign → CreateMessage → GetThread → CreateMessage → GetThread →
    //           CreateMessage → GetThreads → CreateMessage → DeleteCampaign → GetThreads = 11 nodes
    expect(result.nodeResults.length).toBe(11);

    // Verify context has expected data
    expect(result.context.has("authToken")).toBe(true);
    expect(result.context.has("userId")).toBe(true);
    expect(result.context.has("campaignId")).toBe(true);
    expect(result.context.has("thread1Id")).toBe(true);
    expect(result.context.has("thread2Id")).toBe(true);

    // Verify thread IDs are different
    const thread1Id = result.context.get<string>("thread1Id");
    const thread2Id = result.context.get<string>("thread2Id");
    expect(thread1Id).not.toBe(thread2Id);
  });
});
