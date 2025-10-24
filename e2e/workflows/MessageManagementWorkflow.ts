import type { Server } from "http";
import { LoginNode } from "../nodes/auth";
import { CreateCampaignNode, DeleteCampaignNode } from "../nodes/campaign";
import { CreateMessageNode } from "../nodes/message";
import { GetThreadNode, GetThreadsNode } from "../nodes/thread";
import type { WorkflowResult } from "./BaseWorkflow";
import { BaseWorkflow } from "./BaseWorkflow";

/**
 * Workflow for complete message and thread management lifecycle:
 * 1. Login user
 * 2. Create campaign
 * 3. Create message (creates new thread)
 * 4. Get thread (verify thread creation)
 * 5. Add message to existing thread
 * 6. Get thread (verify message added)
 * 7. Create message (creates second thread)
 * 8. Get all threads (verify two threads exist)
 * 9. Add message to second thread
 * 10. Delete campaign
 * 11. Verify threads are deleted (should return empty or error)
 */
export class MessageManagementWorkflow extends BaseWorkflow {
  private readonly email: string;
  private readonly password: string;

  constructor(server: Server, email: string, password: string) {
    super(server);
    this.email = email;
    this.password = password;
  }

  async execute(): Promise<WorkflowResult> {
    // Step 1: Login
    const loginNode = new LoginNode(this.server);
    const loginResult = await this.executeNode(loginNode, {
      email: this.email,
      password: this.password,
    });

    const loginFailure = this.checkNodeSuccess(loginResult);
    if (loginFailure) return loginFailure;

    // Store auth token and user ID in context
    const token = loginResult.data!.login!.token!;
    const userId = loginResult.data!.login!.user!.id;
    this.authToken = token;
    this.context.set("authToken", token);
    this.context.set("userId", userId);

    // Step 2: Create Campaign
    const createCampaignNode = new CreateCampaignNode(
      this.server,
      this.authToken
    );
    const createCampaignResult = await this.executeNode(createCampaignNode, {
      name: "Message Test Campaign",
      setting: "Test Setting",
      tone: "Test Tone",
      ruleset: "Test Ruleset",
    });

    const createCampaignFailure = this.checkNodeSuccess(createCampaignResult);
    if (createCampaignFailure) return createCampaignFailure;

    // Store campaign ID in context
    const campaignId = createCampaignResult.data!.createCampaign!.campaign!.id;
    this.context.set("campaignId", campaignId);

    // Step 3: Create first message (creates new thread)
    const createMessage1Node = new CreateMessageNode(
      this.server,
      this.authToken
    );
    const createMessage1Result = await this.executeNode(createMessage1Node, {
      content: "First message - creates new thread",
      campaignId,
    });

    const createMessage1Failure = this.checkNodeSuccess(createMessage1Result);
    if (createMessage1Failure) return createMessage1Failure;

    // Store first thread ID
    const thread1Id = createMessage1Result.data!.createMessage!.threadId;
    this.context.set("thread1Id", thread1Id);

    // Step 4: Get first thread (verify thread creation)
    const getThread1Node = new GetThreadNode(this.server, this.authToken);
    const getThread1Result = await this.executeNode(getThread1Node, {
      threadId: thread1Id,
      campaignId,
    });

    const getThread1Failure = this.checkNodeSuccess(getThread1Result);
    if (getThread1Failure) return getThread1Failure;

    // Verify thread has 1 message
    const thread1Messages = getThread1Result.data!.getThread!.thread!.messages;
    if (thread1Messages.length !== 1) {
      return this.createFailureResult(
        getThread1Node.nodeId,
        `Expected 1 message in thread, got ${thread1Messages.length}`
      );
    }

    // Step 5: Add second message to existing thread
    const createMessage2Node = new CreateMessageNode(
      this.server,
      this.authToken
    );
    const createMessage2Result = await this.executeNode(createMessage2Node, {
      threadId: thread1Id,
      content: "Second message - adds to existing thread",
      campaignId,
    });

    const createMessage2Failure = this.checkNodeSuccess(createMessage2Result);
    if (createMessage2Failure) return createMessage2Failure;

    // Verify it returned the same thread ID
    if (createMessage2Result.data!.createMessage!.threadId !== thread1Id) {
      return this.createFailureResult(
        createMessage2Node.nodeId,
        `Expected threadId ${thread1Id}, got ${createMessage2Result.data!.createMessage!.threadId}`
      );
    }

    // Step 6: Get thread again (verify message added)
    const getThread2Node = new GetThreadNode(this.server, this.authToken);
    const getThread2Result = await this.executeNode(getThread2Node, {
      threadId: thread1Id,
      campaignId,
    });

    const getThread2Failure = this.checkNodeSuccess(getThread2Result);
    if (getThread2Failure) return getThread2Failure;

    // Verify thread now has 2 messages
    const thread1MessagesAfter =
      getThread2Result.data!.getThread!.thread!.messages;
    if (thread1MessagesAfter.length !== 2) {
      return this.createFailureResult(
        getThread2Node.nodeId,
        `Expected 2 messages in thread, got ${thread1MessagesAfter.length}`
      );
    }

    // Step 7: Create third message (creates second thread)
    const createMessage3Node = new CreateMessageNode(
      this.server,
      this.authToken
    );
    const createMessage3Result = await this.executeNode(createMessage3Node, {
      content: "Third message - creates second thread",
      campaignId,
    });

    const createMessage3Failure = this.checkNodeSuccess(createMessage3Result);
    if (createMessage3Failure) return createMessage3Failure;

    // Store second thread ID
    const thread2Id = createMessage3Result.data!.createMessage!.threadId;
    this.context.set("thread2Id", thread2Id);

    // Verify it's a different thread
    if (thread2Id === thread1Id) {
      return this.createFailureResult(
        createMessage3Node.nodeId,
        "Expected new thread ID, got same as first thread"
      );
    }

    // Step 8: Get all threads (verify two threads exist)
    const getThreadsNode = new GetThreadsNode(this.server, this.authToken);
    const getThreadsResult = await this.executeNode(getThreadsNode, {
      campaignId,
    });

    const getThreadsFailure = this.checkNodeSuccess(getThreadsResult);
    if (getThreadsFailure) return getThreadsFailure;

    // Verify we have 2 threads
    const allThreads = getThreadsResult.data!.threads;
    if (allThreads.length !== 2) {
      return this.createFailureResult(
        getThreadsNode.nodeId,
        `Expected 2 threads, got ${allThreads.length}`
      );
    }

    // Step 9: Add message to second thread
    const createMessage4Node = new CreateMessageNode(
      this.server,
      this.authToken
    );
    const createMessage4Result = await this.executeNode(createMessage4Node, {
      threadId: thread2Id,
      content: "Fourth message - adds to second thread",
      campaignId,
    });

    const createMessage4Failure = this.checkNodeSuccess(createMessage4Result);
    if (createMessage4Failure) return createMessage4Failure;

    // Step 10: Delete campaign
    const deleteCampaignNode = new DeleteCampaignNode(
      this.server,
      this.authToken
    );
    const deleteCampaignResult = await this.executeNode(deleteCampaignNode, {
      campaignId,
    });

    const deleteCampaignFailure = this.checkNodeSuccess(deleteCampaignResult);
    if (deleteCampaignFailure) return deleteCampaignFailure;

    // Step 11: Verify threads are deleted (should return empty array)
    const getThreadsAfterDeleteNode = new GetThreadsNode(
      this.server,
      this.authToken
    );
    const getThreadsAfterDeleteResult = await this.executeNode(
      getThreadsAfterDeleteNode,
      {
        campaignId,
      }
    );

    // This should fail because campaign doesn't exist anymore
    // We expect either an error or an empty threads array
    if (getThreadsAfterDeleteResult.success) {
      const threadsAfterDelete = getThreadsAfterDeleteResult.data!.threads;
      if (threadsAfterDelete.length > 0) {
        return this.createFailureResult(
          getThreadsAfterDeleteNode.nodeId,
          `Expected 0 threads after campaign deletion, got ${threadsAfterDelete.length}`
        );
      }
    }
    // If it failed with an error, that's also acceptable (campaign not found)

    // All steps succeeded!
    return this.createSuccessResult();
  }
}
