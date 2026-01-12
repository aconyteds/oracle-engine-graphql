import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "http";
import { LoginNode } from "../nodes/auth";
import { CreateCampaignNode, DeleteCampaignNode } from "../nodes/campaign";
import { CaptureHumanFeedbackNode, CreateMessageNode } from "../nodes/message";
import { GetThreadNode } from "../nodes/thread";
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

describe("E2E -> Human Feedback", () => {
  let server: Server;
  const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
  const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";
  let authToken: string;
  let campaignId: string;

  beforeAll(async () => {
    server = await setupTestServer();

    // Setup: Login and create campaign for feedback tests
    const loginNode = new LoginNode(server);
    const loginResult = await loginNode.execute({
      email: testEmail,
      password: testPassword,
    });
    authToken = loginResult.data!.login!.token!;

    const createCampaignNode = new CreateCampaignNode(server, authToken);
    const campaignResult = await createCampaignNode.execute({
      name: "Shared Feedback Test Campaign",
      setting: "Test Setting",
      tone: "Test Tone",
      ruleset: "Test Ruleset",
    });
    campaignId = campaignResult.data!.createCampaign!.campaign!.id;
  });

  afterAll(async () => {
    // Cleanup: Delete campaign
    if (campaignId && authToken) {
      const deleteCampaignNode = new DeleteCampaignNode(server, authToken);
      await deleteCampaignNode.execute({ campaignId });
    }

    await teardownTestServer(server);
  });

  test("E2E -> Capture positive feedback with comments", async () => {
    // Create message
    const createMessageNode = new CreateMessageNode(server, authToken);
    const messageResult = await createMessageNode.execute({
      content: "Test message for feedback",
      campaignId,
    });
    expect(messageResult.success).toBe(true);
    const threadId = messageResult.data!.createMessage!.threadId;
    const messageId = messageResult.data!.createMessage!.message.id;

    // Capture positive feedback with comments
    const feedbackNode = new CaptureHumanFeedbackNode(server, authToken);
    const feedbackResult = await feedbackNode.execute({
      messageId,
      humanSentiment: true,
      comments: "Very helpful response!",
      campaignId,
    });
    expect(feedbackResult.success).toBe(true);
    expect(feedbackResult.data!.captureHumanFeedback!.message).toBe(
      "Thank you for providing feedback!"
    );

    // Verify feedback was stored
    const getThreadNode = new GetThreadNode(server, authToken);
    const threadResult = await getThreadNode.execute({ threadId, campaignId });
    expect(threadResult.success).toBe(true);
    const messages = threadResult.data!.getThread!.thread!.messages;
    const feedbackMessage = messages.find((m) => m.id === messageId);
    expect(feedbackMessage).toBeDefined();
    expect(feedbackMessage!.humanSentiment).toBe(true);
  });

  test("E2E -> Capture negative feedback without comments", async () => {
    // Create message
    const createMessageNode = new CreateMessageNode(server, authToken);
    const messageResult = await createMessageNode.execute({
      content: "Test message for negative feedback",
      campaignId,
    });
    expect(messageResult.success).toBe(true);
    const threadId = messageResult.data!.createMessage!.threadId;
    const messageId = messageResult.data!.createMessage!.message.id;

    // Capture negative feedback without comments
    const feedbackNode = new CaptureHumanFeedbackNode(server, authToken);
    const feedbackResult = await feedbackNode.execute({
      messageId,
      humanSentiment: false,
      campaignId,
    });
    expect(feedbackResult.success).toBe(true);

    // Verify feedback was stored
    const getThreadNode = new GetThreadNode(server, authToken);
    const threadResult = await getThreadNode.execute({ threadId, campaignId });
    expect(threadResult.success).toBe(true);
    const messages = threadResult.data!.getThread!.thread!.messages;
    const feedbackMessage = messages.find((m) => m.id === messageId);
    expect(feedbackMessage).toBeDefined();
    expect(feedbackMessage!.humanSentiment).toBe(false);
    // feedbackComments will be null or undefined when not provided
    expect(feedbackMessage!.feedbackComments).toBeFalsy();
  });

  test("E2E -> Duplicate feedback is rejected", async () => {
    // Create message
    const createMessageNode = new CreateMessageNode(server, authToken);
    const messageResult = await createMessageNode.execute({
      content: "Test message for duplicate feedback",
      campaignId,
    });
    expect(messageResult.success).toBe(true);
    const messageId = messageResult.data!.createMessage!.message.id;

    // Capture initial feedback
    const firstFeedbackNode = new CaptureHumanFeedbackNode(server, authToken);
    const firstResult = await firstFeedbackNode.execute({
      messageId,
      humanSentiment: true,
      campaignId,
    });
    expect(firstResult.success).toBe(true);

    // Attempt duplicate feedback
    const secondFeedbackNode = new CaptureHumanFeedbackNode(server, authToken);
    const secondResult = await secondFeedbackNode.execute({
      messageId,
      humanSentiment: false,
      campaignId,
    });
    expect(secondResult.success).toBe(false);
    expect(secondResult.errors).toBeDefined();
    expect(secondResult.errors![0].message).toContain(
      "already submitted feedback"
    );
  });

  test("E2E -> Invalid message ID returns error", async () => {
    // Attempt feedback with invalid message ID (valid MongoDB ObjectID format but doesn't exist)
    const feedbackNode = new CaptureHumanFeedbackNode(server, authToken);
    const feedbackResult = await feedbackNode.execute({
      messageId: "507f1f77bcf86cd799439011", // Valid ObjectID format that doesn't exist
      humanSentiment: true,
      campaignId,
    });
    expect(feedbackResult.success).toBe(false);
    expect(feedbackResult.errors).toBeDefined();
  });

  test("E2E -> Feedback without authentication is rejected", async () => {
    // Create message
    const createMessageNode = new CreateMessageNode(server, authToken);
    const messageResult = await createMessageNode.execute({
      content: "Test message",
      campaignId,
    });
    expect(messageResult.success).toBe(true);
    const messageId = messageResult.data!.createMessage!.message.id;

    // Attempt feedback without authentication
    const unauthFeedbackNode = new CaptureHumanFeedbackNode(server);
    const feedbackResult = await unauthFeedbackNode.execute({
      messageId,
      humanSentiment: true,
      campaignId,
    });
    expect(feedbackResult.success).toBe(false);
    expect(feedbackResult.errors).toBeDefined();
  });

  test("E2E -> Campaign limit validation", async () => {
    // Attempt to create a second campaign (should hit the limit)
    const createCampaignNode = new CreateCampaignNode(server, authToken);
    const campaignResult = await createCampaignNode.execute({
      name: "Second Campaign (Should Fail)",
      setting: "Test Setting",
      tone: "Test Tone",
      ruleset: "Test Ruleset",
    });

    // Verify campaign limit error
    expect(campaignResult.success).toBe(false);
    expect(campaignResult.errors).toBeDefined();
    expect(campaignResult.errors![0].message).toContain(
      "Campaign limit reached"
    );
  });
});
