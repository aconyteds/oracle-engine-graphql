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
 * Workflow for complete Location asset lifecycle:
 * 1. Login user
 * 2. Create campaign
 * 3. Create Location asset
 * 4. Get Location asset (verify creation)
 * 5. List assets (verify Location is in list)
 * 6. Update Location asset
 * 7. Get Location asset (verify update)
 * 8. Delete Location asset
 * 9. List assets (verify Location is removed)
 * 10. Cleanup: Delete campaign
 */
export class LocationAssetWorkflow extends BaseWorkflow {
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
      name: "Location Test Campaign",
      setting: "Test Setting",
      tone: "Test Tone",
      ruleset: "Test Ruleset",
    });

    const createCampaignFailure = this.checkNodeSuccess(createCampaignResult);
    if (createCampaignFailure) return createCampaignFailure;

    const campaignId = createCampaignResult.data!.createCampaign!.campaign!.id;
    this.context.set("campaignId", campaignId);

    // Step 3: Create Location asset
    const createAssetNode = new CreateCampaignAssetNode(
      this.server,
      this.authToken
    );
    const createAssetResult = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "Location",
      name: "The Dragon's Lair",
      gmSummary: "A dangerous cave system inhabited by a red dragon",
      gmNotes: "The dragon is actually cursed and can be reasoned with",
      playerSummary: "A cave with strange smoke rising from it",
      playerNotes: "The entrance is guarded by kobolds",
      locationData: {
        imageUrl: "https://example.com/dragons-lair.jpg",
        description:
          "A vast network of volcanic caves with rivers of lava flowing through them.",
        condition: "Extremely dangerous, high temperatures",
        pointsOfInterest:
          "Dragon's hoard chamber, lava falls, ancient dwarven ruins",
        characters: "Volcanus the Red Dragon, kobold servants",
      },
    });

    const createAssetFailure = this.checkNodeSuccess(createAssetResult);
    if (createAssetFailure) return createAssetFailure;

    const assetId = createAssetResult.data!.createCampaignAsset!.asset!.id;
    this.context.set("assetId", assetId);

    // Step 4: Get Location asset (verify creation)
    const getAssetNode1 = new GetCampaignAssetNode(this.server, this.authToken);
    const getAssetResult1 = await this.executeNode(getAssetNode1, {
      assetId,
      recordType: "Location",
    });

    const getAssetFailure1 = this.checkNodeSuccess(getAssetResult1);
    if (getAssetFailure1) return getAssetFailure1;

    // Verify the Location data
    const locationAsset = getAssetResult1.data!.getCampaignAsset!.asset!;
    if (locationAsset.data.__typename !== "LocationData") {
      return this.createFailureResult(
        getAssetNode1.nodeId,
        `Expected LocationData, got ${locationAsset.data.__typename}`
      );
    }

    // Step 5: List assets (verify Location is in list)
    const listAssetsNode1 = new ListCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const listAssetsResult1 = await this.executeNode(listAssetsNode1, {
      campaignId,
      recordType: "Location",
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

    // Step 6: Update Location asset
    const updateAssetNode = new UpdateCampaignAssetNode(
      this.server,
      this.authToken
    );
    const updateAssetResult = await this.executeNode(updateAssetNode, {
      assetId,
      recordType: "Location",
      name: "The Dragon's Lair (Cleared)",
      gmSummary:
        "A dangerous cave system once inhabited by a red dragon (now defeated)",
      gmNotes: "The curse on the dragon has been lifted",
      playerSummary:
        "A cave with strange smoke rising from it (dragon defeated)",
      playerNotes: "The entrance is unguarded, kobolds are fleeing in terror",
      locationData: {
        description:
          "A vast network of volcanic caves with rivers of lava flowing through them. The dragon is gone.",
        condition: "Still dangerous due to lava, but no dragon",
        pointsOfInterest:
          "Dragon's hoard chamber (empty), lava falls, ancient dwarven ruins",
        characters: "Scattered kobolds fleeing the area",
      },
    });

    const updateAssetFailure = this.checkNodeSuccess(updateAssetResult);
    if (updateAssetFailure) return updateAssetFailure;

    // Step 7: Get Location asset (verify update)
    const getAssetNode2 = new GetCampaignAssetNode(this.server, this.authToken);
    const getAssetResult2 = await this.executeNode(getAssetNode2, {
      assetId,
    });

    const getAssetFailure2 = this.checkNodeSuccess(getAssetResult2);
    if (getAssetFailure2) return getAssetFailure2;

    // Verify the update worked
    const updatedAsset = getAssetResult2.data!.getCampaignAsset!.asset!;
    if (updatedAsset.name !== "The Dragon's Lair (Cleared)") {
      return this.createFailureResult(
        getAssetNode2.nodeId,
        `Expected name 'The Dragon's Lair (Cleared)', got '${updatedAsset.name}'`
      );
    }

    // Step 8: Delete Location asset
    const deleteAssetNode = new DeleteCampaignAssetNode(
      this.server,
      this.authToken
    );
    const deleteAssetResult = await this.executeNode(deleteAssetNode, {
      assetId,
    });

    const deleteAssetFailure = this.checkNodeSuccess(deleteAssetResult);
    if (deleteAssetFailure) return deleteAssetFailure;

    // Step 9: List assets (verify Location is removed)
    const listAssetsNode2 = new ListCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const listAssetsResult2 = await this.executeNode(listAssetsNode2, {
      campaignId,
      recordType: "Location",
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
