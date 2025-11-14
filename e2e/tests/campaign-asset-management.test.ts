import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "http";
import { LoginNode } from "../nodes/auth";
import { CreateCampaignNode } from "../nodes/campaign";
import {
  CreateCampaignAssetNode,
  ListCampaignAssetsNode,
} from "../nodes/campaignAsset";
import { setupTestServer, teardownTestServer } from "../setup";
import { LocationAssetWorkflow } from "../workflows/LocationAssetWorkflow";
import { NPCAssetWorkflow } from "../workflows/NPCAssetWorkflow";
import { PlotAssetWorkflow } from "../workflows/PlotAssetWorkflow";

describe("E2E -> Campaign Asset Management", () => {
  let server: Server;

  beforeAll(async () => {
    server = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer(server);
  });

  test("Complete Location asset lifecycle: create, get, update, delete", async () => {
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    const workflow = new LocationAssetWorkflow(server, testEmail, testPassword);
    const result = await workflow.execute();

    // Assert workflow succeeded
    expect(result.success).toBe(true);
    expect(result.failedNode).toBeUndefined();
    expect(result.error).toBeUndefined();

    // Assert all nodes executed
    // Workflow: Login → CreateCampaign → CreateAsset → Get → List → Update → Get → Delete → List → DeleteCampaign = 10 nodes
    expect(result.nodeResults.length).toBe(10);

    // Verify context has expected data
    expect(result.context.has("authToken")).toBe(true);
    expect(result.context.has("campaignId")).toBe(true);
    expect(result.context.has("assetId")).toBe(true);
  });

  test("Complete NPC asset lifecycle: create, get, update, delete", async () => {
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    const workflow = new NPCAssetWorkflow(server, testEmail, testPassword);
    const result = await workflow.execute();

    // Assert workflow succeeded
    expect(result.success).toBe(true);
    expect(result.failedNode).toBeUndefined();
    expect(result.error).toBeUndefined();

    // Assert all nodes executed
    // Workflow: Login → CreateCampaign → CreateAsset → Get → List → Update → Get → Delete → List → DeleteCampaign = 10 nodes
    expect(result.nodeResults.length).toBe(10);

    // Verify context has expected data
    expect(result.context.has("authToken")).toBe(true);
    expect(result.context.has("campaignId")).toBe(true);
    expect(result.context.has("assetId")).toBe(true);
  });

  test("Complete Plot asset lifecycle: create, get, update, delete", async () => {
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    const workflow = new PlotAssetWorkflow(server, testEmail, testPassword);
    const result = await workflow.execute();

    // Assert workflow succeeded
    expect(result.success).toBe(true);
    expect(result.failedNode).toBeUndefined();
    expect(result.error).toBeUndefined();

    // Assert all nodes executed
    // Workflow: Login → CreateCampaign → CreateAsset → Get → List → Update → Get → Delete → List → DeleteCampaign = 10 nodes
    expect(result.nodeResults.length).toBe(10);

    // Verify context has expected data
    expect(result.context.has("authToken")).toBe(true);
    expect(result.context.has("campaignId")).toBe(true);
    expect(result.context.has("assetId")).toBe(true);
  });

  test("Campaign asset creation requires authentication", async () => {
    // Try to create an asset without authentication
    const createAssetNode = new CreateCampaignAssetNode(server);
    const result = await createAssetNode.execute({
      campaignId: "fake-campaign-id",
      recordType: "Location",
      name: "Test Location",
      locationData: {
        description: "Test",
        condition: "Test",
        pointsOfInterest: "Test",
        characters: "Test",
        dmNotes: "Test",
        sharedWithPlayers: "Test",
      },
    });

    // Assert the operation failed due to missing authentication
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test("List assets filters by recordType correctly", async () => {
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    // Login
    const loginNode = new LoginNode(server);
    const loginResult = await loginNode.execute({
      email: testEmail,
      password: testPassword,
    });

    if (!loginResult.success) {
      throw new Error("Login failed");
    }

    const authToken = loginResult.data!.login!.token!;

    // Create Campaign
    const createCampaignNode = new CreateCampaignNode(server, authToken);
    const createCampaignResult = await createCampaignNode.execute({
      name: "Asset Filter Test Campaign",
      setting: "Test",
      tone: "Test",
      ruleset: "Test",
    });

    if (!createCampaignResult.success) {
      throw new Error("Campaign creation failed");
    }

    const campaignId = createCampaignResult.data!.createCampaign!.campaign!.id;

    try {
      // Create a Location asset
      const createLocationNode = new CreateCampaignAssetNode(server, authToken);
      const locationResult = await createLocationNode.execute({
        campaignId,
        recordType: "Location",
        name: "Test Location",
        locationData: {
          description: "Test description",
          condition: "Good",
          pointsOfInterest: "None",
          characters: "None",
          dmNotes: "Test notes",
          sharedWithPlayers: "Visible",
        },
      });

      expect(locationResult.success).toBe(true);

      // Create an NPC asset
      const createNPCNode = new CreateCampaignAssetNode(server, authToken);
      const npcResult = await createNPCNode.execute({
        campaignId,
        recordType: "NPC",
        name: "Test NPC",
        npcData: {
          physicalDescription: "Test description",
          motivation: "Test motivation",
          mannerisms: "Test mannerisms",
          dmNotes: "Test notes",
          sharedWithPlayers: "Known",
        },
      });

      expect(npcResult.success).toBe(true);

      // List only Location assets
      const listLocationsNode = new ListCampaignAssetsNode(server, authToken);
      const listLocationsResult = await listLocationsNode.execute({
        campaignId,
        recordType: "Location",
      });

      expect(listLocationsResult.success).toBe(true);
      const locationAssets =
        listLocationsResult.data!.listCampaignAssets!.assets;
      expect(locationAssets.length).toBe(1);
      expect(locationAssets[0].recordType).toBe("Location");

      // List only NPC assets
      const listNPCsNode = new ListCampaignAssetsNode(server, authToken);
      const listNPCsResult = await listNPCsNode.execute({
        campaignId,
        recordType: "NPC",
      });

      expect(listNPCsResult.success).toBe(true);
      const npcAssets = listNPCsResult.data!.listCampaignAssets!.assets;
      expect(npcAssets.length).toBe(1);
      expect(npcAssets[0].recordType).toBe("NPC");

      // List all assets (no filter)
      const listAllNode = new ListCampaignAssetsNode(server, authToken);
      const listAllResult = await listAllNode.execute({
        campaignId,
      });

      expect(listAllResult.success).toBe(true);
      const allAssets = listAllResult.data!.listCampaignAssets!.assets;
      expect(allAssets.length).toBe(2);
    } finally {
      // Cleanup: Delete campaign (will cascade delete assets)
      const { DeleteCampaignNode } = await import("../nodes/campaign");
      const deleteCampaignNode = new DeleteCampaignNode(server, authToken);
      await deleteCampaignNode.execute({ campaignId });
    }
  });
});
