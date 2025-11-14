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
 * Workflow for complete NPC asset lifecycle:
 * 1. Login user
 * 2. Create campaign
 * 3. Create NPC asset
 * 4. Get NPC asset (verify creation)
 * 5. List assets (verify NPC is in list)
 * 6. Update NPC asset
 * 7. Get NPC asset (verify update)
 * 8. Delete NPC asset
 * 9. List assets (verify NPC is removed)
 * 10. Cleanup: Delete campaign
 */
export class NPCAssetWorkflow extends BaseWorkflow {
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
      name: "NPC Test Campaign",
      setting: "Test Setting",
      tone: "Test Tone",
      ruleset: "Test Ruleset",
    });

    const createCampaignFailure = this.checkNodeSuccess(createCampaignResult);
    if (createCampaignFailure) return createCampaignFailure;

    const campaignId = createCampaignResult.data!.createCampaign!.campaign!.id;
    this.context.set("campaignId", campaignId);

    // Step 3: Create NPC asset
    const createAssetNode = new CreateCampaignAssetNode(
      this.server,
      this.authToken
    );
    const createAssetResult = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "NPC",
      name: "Elara Moonwhisper",
      summary: "A wise elven ranger and guide through the Mistwood",
      playerSummary: "A friendly elven ranger who knows the forest well",
      npcData: {
        imageUrl: "https://example.com/elara.jpg",
        physicalDescription:
          "Tall elf with silver hair and piercing green eyes. Wears forest-green leathers and carries a longbow.",
        motivation:
          "Protect the Mistwood from those who would harm it, avenge her fallen companions",
        mannerisms:
          "Speaks softly but firmly. Often touches the trees when walking through the forest. Has a habit of whistling bird calls.",
        dmNotes:
          "She knows the location of the ancient temple but won't reveal it until she trusts the party",
        sharedWithPlayers:
          "She seems knowledgeable about the forest and its dangers",
      },
    });

    const createAssetFailure = this.checkNodeSuccess(createAssetResult);
    if (createAssetFailure) return createAssetFailure;

    const assetId = createAssetResult.data!.createCampaignAsset!.asset!.id;
    this.context.set("assetId", assetId);

    // Step 4: Get NPC asset (verify creation)
    const getAssetNode1 = new GetCampaignAssetNode(this.server, this.authToken);
    const getAssetResult1 = await this.executeNode(getAssetNode1, {
      assetId,
      recordType: "NPC",
    });

    const getAssetFailure1 = this.checkNodeSuccess(getAssetResult1);
    if (getAssetFailure1) return getAssetFailure1;

    // Verify the NPC data
    const npcAsset = getAssetResult1.data!.getCampaignAsset!.asset!;
    if (npcAsset.data.__typename !== "NPCData") {
      return this.createFailureResult(
        getAssetNode1.nodeId,
        `Expected NPCData, got ${npcAsset.data.__typename}`
      );
    }

    // Step 5: List assets (verify NPC is in list)
    const listAssetsNode1 = new ListCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const listAssetsResult1 = await this.executeNode(listAssetsNode1, {
      campaignId,
      recordType: "NPC",
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

    // Step 6: Update NPC asset
    const updateAssetNode = new UpdateCampaignAssetNode(
      this.server,
      this.authToken
    );
    const updateAssetResult = await this.executeNode(updateAssetNode, {
      assetId,
      recordType: "NPC",
      name: "Elara Moonwhisper (Trusted Ally)",
      summary:
        "A wise elven ranger and trusted guide through the Mistwood. Now a close ally of the party.",
      npcData: {
        physicalDescription:
          "Tall elf with silver hair and piercing green eyes. Wears forest-green leathers and carries a longbow. Now wears a party emblem as a brooch.",
        motivation:
          "Protect the Mistwood and help the party stop the corruption spreading through the forest",
        mannerisms:
          "Speaks warmly to the party. Often touches the trees when walking through the forest. Has a habit of whistling bird calls. Now shares food from her hunting.",
        dmNotes:
          "She has revealed the temple location and will accompany the party there. She is developing feelings for one of the PCs.",
        sharedWithPlayers:
          "She is now a trusted ally and has offered to guide the party to the ancient temple",
      },
    });

    const updateAssetFailure = this.checkNodeSuccess(updateAssetResult);
    if (updateAssetFailure) return updateAssetFailure;

    // Step 7: Get NPC asset (verify update)
    const getAssetNode2 = new GetCampaignAssetNode(this.server, this.authToken);
    const getAssetResult2 = await this.executeNode(getAssetNode2, {
      assetId,
    });

    const getAssetFailure2 = this.checkNodeSuccess(getAssetResult2);
    if (getAssetFailure2) return getAssetFailure2;

    // Verify the update worked
    const updatedAsset = getAssetResult2.data!.getCampaignAsset!.asset!;
    if (updatedAsset.name !== "Elara Moonwhisper (Trusted Ally)") {
      return this.createFailureResult(
        getAssetNode2.nodeId,
        `Expected name 'Elara Moonwhisper (Trusted Ally)', got '${updatedAsset.name}'`
      );
    }

    // Step 8: Delete NPC asset
    const deleteAssetNode = new DeleteCampaignAssetNode(
      this.server,
      this.authToken
    );
    const deleteAssetResult = await this.executeNode(deleteAssetNode, {
      assetId,
    });

    const deleteAssetFailure = this.checkNodeSuccess(deleteAssetResult);
    if (deleteAssetFailure) return deleteAssetFailure;

    // Step 9: List assets (verify NPC is removed)
    const listAssetsNode2 = new ListCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const listAssetsResult2 = await this.executeNode(listAssetsNode2, {
      campaignId,
      recordType: "NPC",
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
