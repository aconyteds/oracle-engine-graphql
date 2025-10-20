import type { Server } from "http";
import { LoginNode } from "../nodes/auth";
import {
  CreateCampaignNode,
  DeleteCampaignNode,
  GetCampaignNode,
  UpdateCampaignNode,
} from "../nodes/campaign";
import type { WorkflowResult } from "./BaseWorkflow";
import { BaseWorkflow } from "./BaseWorkflow";

/**
 * Workflow for complete campaign management lifecycle:
 * 1. Login user
 * 2. Create campaign
 * 3. Get campaign (verify creation)
 * 4. Update campaign
 * 5. Get campaign (verify update)
 * 6. Delete campaign
 */
export class CampaignManagementWorkflow extends BaseWorkflow {
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
    const createNode = new CreateCampaignNode(this.server, this.authToken);
    const createResult = await this.executeNode(createNode, {
      name: "Test Campaign",
      setting: "Forgotten Realms",
      tone: "Heroic",
      ruleset: "D&D 5e",
    });

    const createFailure = this.checkNodeSuccess(createResult);
    if (createFailure) return createFailure;

    // Store campaign ID in context
    const campaignId = createResult.data!.createCampaign!.campaign!.id;
    this.context.set("campaignId", campaignId);

    // Step 3: Get Campaign (verify creation)
    const getNode1 = new GetCampaignNode(this.server, this.authToken);
    const getResult1 = await this.executeNode(getNode1, { campaignId });

    const getFailure1 = this.checkNodeSuccess(getResult1);
    if (getFailure1) return getFailure1;

    // Step 4: Update Campaign
    const updateNode = new UpdateCampaignNode(this.server, this.authToken);
    const updateResult = await this.executeNode(updateNode, {
      campaignId,
      name: "Updated Campaign",
      tone: "Gritty",
    });

    const updateFailure = this.checkNodeSuccess(updateResult);
    if (updateFailure) return updateFailure;

    // Step 5: Get Campaign (verify update)
    const getNode2 = new GetCampaignNode(this.server, this.authToken);
    const getResult2 = await this.executeNode(getNode2, { campaignId });

    const getFailure2 = this.checkNodeSuccess(getResult2);
    if (getFailure2) return getFailure2;

    // Verify the update worked
    const updatedCampaign = getResult2.data!.getCampaign!.campaign!;
    if (updatedCampaign.name !== "Updated Campaign") {
      return this.createFailureResult(
        getNode2.nodeId,
        `Expected campaign name to be 'Updated Campaign', got '${updatedCampaign.name}'`
      );
    }
    if (updatedCampaign.tone !== "Gritty") {
      return this.createFailureResult(
        getNode2.nodeId,
        `Expected campaign tone to be 'Gritty', got '${updatedCampaign.tone}'`
      );
    }

    // Step 6: Delete Campaign
    const deleteNode = new DeleteCampaignNode(this.server, this.authToken);
    const deleteResult = await this.executeNode(deleteNode, { campaignId });

    const deleteFailure = this.checkNodeSuccess(deleteResult);
    if (deleteFailure) return deleteFailure;

    // All steps succeeded!
    return this.createSuccessResult();
  }
}
