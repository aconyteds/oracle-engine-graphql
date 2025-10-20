import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "http";
import { setupTestServer, teardownTestServer } from "../setup";
import { CampaignManagementWorkflow } from "../workflows/CampaignManagementWorkflow";

describe("E2E -> Campaign Management Workflow", () => {
  let server: Server;

  beforeAll(async () => {
    server = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer(server);
  });

  test("Complete campaign lifecycle: create, update, delete", async () => {
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    const workflow = new CampaignManagementWorkflow(
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
    // Workflow: Login → Create → Get → Update → Get → Delete = 6 nodes
    expect(result.nodeResults.length).toBe(6);

    // Verify context has expected data
    expect(result.context.has("authToken")).toBe(true);
    expect(result.context.has("userId")).toBe(true);
    expect(result.context.has("campaignId")).toBe(true);
  });

  test("Campaign creation requires authentication", async () => {
    // This workflow should fail at the login step with invalid credentials
    const workflow = new CampaignManagementWorkflow(
      server,
      "invalid@example.com",
      "wrongpassword"
    );
    const result = await workflow.execute();

    // Assert workflow failed
    expect(result.success).toBe(false);
    expect(result.failedNode).toBe("LoginNode");
    expect(result.error).toBeDefined();
  });
});
