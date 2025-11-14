import type { Server } from "http";
import { LoginNode } from "../nodes/auth";
import { CreateCampaignNode, DeleteCampaignNode } from "../nodes/campaign";
import {
  CreateCampaignAssetNode,
  DeleteCampaignAssetNode,
  GetCampaignAssetNode,
  ListCampaignAssetsNode,
  UpdateCampaignAssetNode,
} from "../nodes/campaignAsset";
import type { WorkflowResult } from "./BaseWorkflow";
import { BaseWorkflow } from "./BaseWorkflow";

/**
 * Workflow for complete Plot asset lifecycle:
 * 1. Login user
 * 2. Create campaign
 * 3. Create Plot asset
 * 4. Get Plot asset (verify creation)
 * 5. List assets (verify Plot is in list)
 * 6. Update Plot asset (change status/urgency)
 * 7. Get Plot asset (verify update)
 * 8. Delete Plot asset
 * 9. List assets (verify Plot is removed)
 * 10. Cleanup: Delete campaign
 */
export class PlotAssetWorkflow extends BaseWorkflow {
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

    // Store auth token
    const token = loginResult.data!.login!.token!;
    this.authToken = token;
    this.context.set("authToken", token);

    // Step 2: Create Campaign
    const createCampaignNode = new CreateCampaignNode(
      this.server,
      this.authToken
    );
    const createCampaignResult = await this.executeNode(createCampaignNode, {
      name: "Plot Test Campaign",
      setting: "Test Setting",
      tone: "Test Tone",
      ruleset: "Test Ruleset",
    });

    const createCampaignFailure = this.checkNodeSuccess(createCampaignResult);
    if (createCampaignFailure) return createCampaignFailure;

    const campaignId = createCampaignResult.data!.createCampaign!.campaign!.id;
    this.context.set("campaignId", campaignId);

    // Step 3: Create Plot asset
    const createAssetNode = new CreateCampaignAssetNode(
      this.server,
      this.authToken
    );
    const createAssetResult = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "Plot",
      name: "The Corruption of the Mistwood",
      summary:
        "Dark forces are corrupting the ancient forest, turning creatures hostile and spreading blight",
      playerSummary:
        "Something is wrong with the forest - animals are acting strangely and plants are dying",
      plotData: {
        dmNotes:
          "The BBEG is actually the mayor's advisor. The ritual can be stopped by destroying 3 corruption nodes OR by convincing the druid circle to intervene.",
        sharedWithPlayers:
          "The forest rangers mention that animals are fleeing the deep woods and strange purple mist has been seen at night.",
        status: "Rumored",
        urgency: "TimeSensitive",
      },
    });

    const createAssetFailure = this.checkNodeSuccess(createAssetResult);
    if (createAssetFailure) return createAssetFailure;

    const assetId = createAssetResult.data!.createCampaignAsset!.asset!.id;
    this.context.set("assetId", assetId);

    // Step 4: Get Plot asset (verify creation)
    const getAssetNode1 = new GetCampaignAssetNode(this.server, this.authToken);
    const getAssetResult1 = await this.executeNode(getAssetNode1, {
      assetId,
      recordType: "Plot",
    });

    const getAssetFailure1 = this.checkNodeSuccess(getAssetResult1);
    if (getAssetFailure1) return getAssetFailure1;

    // Verify the Plot data
    const plotAsset = getAssetResult1.data!.getCampaignAsset!.asset!;
    if (plotAsset.data.__typename !== "PlotData") {
      return this.createFailureResult(
        getAssetNode1.nodeId,
        `Expected PlotData, got ${plotAsset.data.__typename}`
      );
    }

    // Step 5: List assets (verify Plot is in list)
    const listAssetsNode1 = new ListCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const listAssetsResult1 = await this.executeNode(listAssetsNode1, {
      campaignId,
      recordType: "Plot",
    });

    const listAssetsFailure1 = this.checkNodeSuccess(listAssetsResult1);
    if (listAssetsFailure1) return listAssetsFailure1;

    // Verify the asset is in the list
    const assets1 = listAssetsResult1.data!.listCampaignAssets!.assets;
    const foundAsset = assets1.find((a) => a.id === assetId);
    if (!foundAsset) {
      return this.createFailureResult(
        listAssetsNode1.nodeId,
        "Created asset not found in list"
      );
    }

    // Step 6: Update Plot asset (change status/urgency)
    const updateAssetNode = new UpdateCampaignAssetNode(
      this.server,
      this.authToken
    );
    const updateAssetResult = await this.executeNode(updateAssetNode, {
      assetId,
      recordType: "Plot",
      name: "The Corruption of the Mistwood [ACTIVE]",
      summary:
        "The party has discovered the cult's ritual and is actively working to stop it. Time is running out!",
      plotData: {
        dmNotes:
          "Party confronted the advisor who fled to the ritual site. Druid circle has agreed to help if party can buy them time. Next session will be the final confrontation.",
        sharedWithPlayers:
          "You have destroyed 3 corruption nodes. The ritual site is at the ancient oak in the forest's center. You have 2 days to stop the final ritual.",
        status: "InProgress",
        urgency: "Critical",
      },
    });

    const updateAssetFailure = this.checkNodeSuccess(updateAssetResult);
    if (updateAssetFailure) return updateAssetFailure;

    // Step 7: Get Plot asset (verify update)
    const getAssetNode2 = new GetCampaignAssetNode(this.server, this.authToken);
    const getAssetResult2 = await this.executeNode(getAssetNode2, {
      assetId,
    });

    const getAssetFailure2 = this.checkNodeSuccess(getAssetResult2);
    if (getAssetFailure2) return getAssetFailure2;

    // Verify the update worked
    const updatedAsset = getAssetResult2.data!.getCampaignAsset!.asset!;
    if (updatedAsset.name !== "The Corruption of the Mistwood [ACTIVE]") {
      return this.createFailureResult(
        getAssetNode2.nodeId,
        `Expected name 'The Corruption of the Mistwood [ACTIVE]', got '${updatedAsset.name}'`
      );
    }

    // Verify Plot-specific data was updated
    if (updatedAsset.data.__typename === "PlotData") {
      if (updatedAsset.data.status !== "InProgress") {
        return this.createFailureResult(
          getAssetNode2.nodeId,
          `Expected status 'InProgress', got '${updatedAsset.data.status}'`
        );
      }
      if (updatedAsset.data.urgency !== "Critical") {
        return this.createFailureResult(
          getAssetNode2.nodeId,
          `Expected urgency 'Critical', got '${updatedAsset.data.urgency}'`
        );
      }
    }

    // Step 8: Delete Plot asset
    const deleteAssetNode = new DeleteCampaignAssetNode(
      this.server,
      this.authToken
    );
    const deleteAssetResult = await this.executeNode(deleteAssetNode, {
      assetId,
    });

    const deleteAssetFailure = this.checkNodeSuccess(deleteAssetResult);
    if (deleteAssetFailure) return deleteAssetFailure;

    // Step 9: List assets (verify Plot is removed)
    const listAssetsNode2 = new ListCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const listAssetsResult2 = await this.executeNode(listAssetsNode2, {
      campaignId,
      recordType: "Plot",
    });

    const listAssetsFailure2 = this.checkNodeSuccess(listAssetsResult2);
    if (listAssetsFailure2) return listAssetsFailure2;

    // Verify the asset is not in the list
    const assets2 = listAssetsResult2.data!.listCampaignAssets!.assets;
    const stillExists = assets2.find((a) => a.id === assetId);
    if (stillExists) {
      return this.createFailureResult(
        listAssetsNode2.nodeId,
        "Deleted asset still found in list"
      );
    }

    // Step 10: Cleanup - Delete campaign
    const deleteCampaignNode = new DeleteCampaignNode(
      this.server,
      this.authToken
    );
    const deleteCampaignResult = await this.executeNode(deleteCampaignNode, {
      campaignId,
    });

    const deleteCampaignFailure = this.checkNodeSuccess(deleteCampaignResult);
    if (deleteCampaignFailure) return deleteCampaignFailure;

    // All steps succeeded!
    return this.createSuccessResult();
  }
}
