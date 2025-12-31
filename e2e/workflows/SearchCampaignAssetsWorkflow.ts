import { mock } from "bun:test";
import type { Server } from "http";
import { LoginNode } from "../nodes/auth";
import { CreateCampaignNode, DeleteCampaignNode } from "../nodes/campaign";
import {
  CreateCampaignAssetNode,
  SearchCampaignAssetsNode,
} from "../nodes/campaignAsset";
import type { WorkflowResult } from "./BaseWorkflow";
import { BaseWorkflow } from "./BaseWorkflow";

/**
 * Workflow for testing SearchCampaignAssets query:
 * 1. Login user
 * 2. Create campaign
 * 3. Create 4 diverse test assets (2 Locations, 1 NPC, 1 Plot)
 * 4. Search with query "wizard tower" (should find Ancient Tower)
 * 5. Search with recordType=Location filter
 * 6. Search with limit=2
 * 7. Search with minScore=0.8
 * 8. Cleanup: Delete campaign
 *
 * Note: This workflow uses mocked vector search since standard MongoDB
 * doesn't support $vectorSearch aggregation (Atlas-only feature).
 */
export class SearchCampaignAssetsWorkflow extends BaseWorkflow {
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

    // Step 2: Create Campaign with unique name
    const createCampaignNode = new CreateCampaignNode(
      this.server,
      this.authToken
    );
    const createCampaignResult = await this.executeNode(createCampaignNode, {
      name: `Search Test Campaign ${Date.now()}`,
      setting: "Fantasy Realm",
      tone: "Adventure",
      ruleset: "D&D 5e",
    });

    const createCampaignFailure = this.checkNodeSuccess(createCampaignResult);
    if (createCampaignFailure) return createCampaignFailure;

    const campaignId = createCampaignResult.data!.createCampaign!.campaign!.id;
    this.context.set("campaignId", campaignId);

    // Step 3: Create test assets with diverse content
    const createAssetNode = new CreateCampaignAssetNode(
      this.server,
      this.authToken
    );

    // Asset 1: Ancient Tower (Location) - should match "wizard tower" search
    const asset1Result = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "Location",
      name: "Ancient Tower",
      gmSummary: "An old wizard's tower filled with arcane knowledge",
      gmNotes: "Contains powerful artifact on top floor",
      playerSummary: "A tall stone tower with mystical energy",
      playerNotes: "The tower radiates magic and seems to hum softly",
      locationData: {
        imageUrl: "https://example.com/tower.jpg",
        description:
          "A tall stone tower built centuries ago by a powerful wizard. Arcane symbols glow faintly on the walls.",
        condition: "Well-preserved despite its age",
        pointsOfInterest:
          "Library on third floor, alchemy lab, observation deck",
        characters: "Ghostly wizard apparition, magical constructs",
      },
    });

    const asset1Failure = this.checkNodeSuccess(asset1Result);
    if (asset1Failure) return asset1Failure;
    const asset1Id = asset1Result.data!.createCampaignAsset!.asset!.id;
    this.context.set("asset1Id", asset1Id);

    // Asset 2: Mysterious Merchant (NPC) - should match "merchant" search
    const asset2Result = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "NPC",
      name: "Mysterious Merchant",
      gmSummary: "A traveling merchant who sells rare potions and artifacts",
      gmNotes: "Actually a disguised dragon collecting magical items",
      playerSummary: "A hooded figure with unusual wares",
      playerNotes: "Sells potions and magical trinkets at fair prices",
      npcData: {
        imageUrl: "https://example.com/merchant.jpg",
        physicalDescription:
          "Cloaked figure with gleaming eyes, carries a large pack of exotic goods",
        motivation: "Collect rare items and spread them across the realm",
        mannerisms:
          "Speaks in riddles, always offers a deal, never reveals face",
      },
    });

    const asset2Failure = this.checkNodeSuccess(asset2Result);
    if (asset2Failure) return asset2Failure;
    const asset2Id = asset2Result.data!.createCampaignAsset!.asset!.id;
    this.context.set("asset2Id", asset2Id);

    // Asset 3: Dragon Threat (Plot) - should match "dragon" search
    const asset3Result = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "Plot",
      name: "Dragon Threat",
      gmSummary: "A red dragon has been terrorizing nearby villages",
      gmNotes:
        "The dragon is being controlled by an evil cult. Defeating the dragon won't solve the problem.",
      playerSummary: "Villages report attacks by a large winged creature",
      playerNotes:
        "Villagers are offering a reward for anyone who can stop the attacks",
      plotData: {
        status: "InProgress",
        urgency: "Critical",
      },
    });

    const asset3Failure = this.checkNodeSuccess(asset3Result);
    if (asset3Failure) return asset3Failure;
    const asset3Id = asset3Result.data!.createCampaignAsset!.asset!.id;
    this.context.set("asset3Id", asset3Id);

    // Asset 4: Dark Cave (Location) - should match "cave" search
    const asset4Result = await this.executeNode(createAssetNode, {
      campaignId,
      recordType: "Location",
      name: "Dark Cave",
      gmSummary: "A mysterious cave entrance hidden in the forest",
      gmNotes: "Leads to the cult's underground temple",
      playerSummary: "A dark opening in the hillside",
      playerNotes: "Local hunters avoid this area and warn others away",
      locationData: {
        imageUrl: "https://example.com/cave.jpg",
        description:
          "A natural cave formation that descends deep underground. Strange sounds echo from within.",
        condition: "Dark, damp, possibly dangerous",
        pointsOfInterest:
          "Underground river, crystal formations, ancient cave paintings",
        characters: "Unknown creatures lurking in the depths",
      },
    });

    const asset4Failure = this.checkNodeSuccess(asset4Result);
    if (asset4Failure) return asset4Failure;
    const asset4Id = asset4Result.data!.createCampaignAsset!.asset!.id;
    this.context.set("asset4Id", asset4Id);

    // Setup mock for vector search
    // We'll mock the searchCampaignAssets function to return our test assets
    const mockVectorSearch = mock();

    // Mock implementation that returns assets and timings based on query
    mockVectorSearch.mockImplementation(
      async (input: {
        campaignId: string;
        query: string;
        recordType?: string;
        limit?: number;
        minScore?: number;
      }) => {
        // Get all created assets
        const allAssets = [
          {
            id: asset1Id,
            campaignId,
            name: "Ancient Tower",
            recordType: "Location",
            summary: "An old wizard's tower filled with arcane knowledge",
            playerSummary: "A tall stone tower with mystical energy",
            createdAt: new Date(),
            updatedAt: new Date(),
            Embeddings: [],
            locationData: {},
            npcData: null,
            plotData: null,
            sessionEventLink: [],
            score: 0.0,
          },
          {
            id: asset2Id,
            campaignId,
            name: "Mysterious Merchant",
            recordType: "NPC",
            summary:
              "A traveling merchant who sells rare potions and artifacts",
            playerSummary: "A hooded figure with unusual wares",
            createdAt: new Date(),
            updatedAt: new Date(),
            Embeddings: [],
            locationData: null,
            npcData: {},
            plotData: null,
            sessionEventLink: [],
            score: 0.0,
          },
          {
            id: asset3Id,
            campaignId,
            name: "Dragon Threat",
            recordType: "Plot",
            summary: "A red dragon has been terrorizing nearby villages",
            playerSummary: "Villages report attacks by a large winged creature",
            createdAt: new Date(),
            updatedAt: new Date(),
            Embeddings: [],
            locationData: null,
            npcData: null,
            plotData: {},
            sessionEventLink: [],
            score: 0.0,
          },
          {
            id: asset4Id,
            campaignId,
            name: "Dark Cave",
            recordType: "Location",
            summary: "A mysterious cave entrance hidden in the forest",
            playerSummary: "A dark opening in the hillside",
            createdAt: new Date(),
            updatedAt: new Date(),
            Embeddings: [],
            locationData: {},
            npcData: null,
            plotData: null,
            sessionEventLink: [],
            score: 0.0,
          },
        ];

        // Assign scores based on query content (simulating vector similarity)
        const query = input.query.toLowerCase();
        let results = allAssets.map((asset) => {
          let score = 0.5; // Default score

          // Simulate vector similarity based on keywords
          if (query.includes("wizard") || query.includes("tower")) {
            if (asset.name === "Ancient Tower") score = 0.95;
            else if (asset.name === "Dark Cave") score = 0.3;
          } else if (query.includes("merchant") || query.includes("potion")) {
            if (asset.name === "Mysterious Merchant") score = 0.92;
          } else if (query.includes("dragon")) {
            if (asset.name === "Dragon Threat") score = 0.98;
            else if (asset.name === "Dark Cave") score = 0.6; // Cave is related
          } else if (query.includes("cave")) {
            if (asset.name === "Dark Cave") score = 0.94;
          }

          return { ...asset, score };
        });

        // Apply filters
        if (input.recordType) {
          results = results.filter((r) => r.recordType === input.recordType);
        }

        if (input.minScore !== undefined && input.minScore !== null) {
          const minScore = input.minScore;
          results = results.filter((r) => r.score >= minScore);
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Apply limit
        if (input.limit !== undefined && input.limit !== null) {
          results = results.slice(0, input.limit);
        }

        return {
          assets: results,
          timings: {
            total: 10,
            embedding: 5,
            vectorSearch: 3,
            conversion: 2,
          },
        };
      }
    );

    // Apply the mock
    mock.module("../../src/data/MongoDB/campaignAsset", () => ({
      searchCampaignAssets: mockVectorSearch,
    }));

    // Step 4: Search with query "wizard tower"
    const searchNode1 = new SearchCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const searchResult1 = await this.executeNode(searchNode1, {
      campaignId,
      query: "wizard tower",
    });

    const searchFailure1 = this.checkNodeSuccess(searchResult1);
    if (searchFailure1) return searchFailure1;

    // Verify Ancient Tower is the top result
    const assets1 = searchResult1.data!.searchCampaignAssets!.assets;
    if (assets1.length === 0 || assets1[0].asset.name !== "Ancient Tower") {
      return this.createFailureResult(
        searchNode1.nodeId,
        `Expected Ancient Tower as top result for "wizard tower" query, got ${assets1[0]?.asset.name || "no results"}`
      );
    }

    // Step 5: Search with recordType filter (Location only)
    const searchNode2 = new SearchCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const searchResult2 = await this.executeNode(searchNode2, {
      campaignId,
      query: "wizard tower",
      recordType: "Location",
    });

    const searchFailure2 = this.checkNodeSuccess(searchResult2);
    if (searchFailure2) return searchFailure2;

    // Verify all results are Locations
    const assets2 = searchResult2.data!.searchCampaignAssets!.assets;
    for (const result of assets2) {
      if (result.asset.recordType !== "Location") {
        return this.createFailureResult(
          searchNode2.nodeId,
          `Expected only Location assets, got ${result.asset.recordType}`
        );
      }
    }

    // Step 6: Search with limit=2
    const searchNode3 = new SearchCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const searchResult3 = await this.executeNode(searchNode3, {
      campaignId,
      query: "dragon",
      limit: 2,
    });

    const searchFailure3 = this.checkNodeSuccess(searchResult3);
    if (searchFailure3) return searchFailure3;

    // Verify limit is respected
    const assets3 = searchResult3.data!.searchCampaignAssets!.assets;
    if (assets3.length > 2) {
      return this.createFailureResult(
        searchNode3.nodeId,
        `Expected max 2 results with limit=2, got ${assets3.length}`
      );
    }

    // Step 7: Search with minScore=0.8
    const searchNode4 = new SearchCampaignAssetsNode(
      this.server,
      this.authToken
    );
    const searchResult4 = await this.executeNode(searchNode4, {
      campaignId,
      query: "dragon",
      minScore: 0.8,
    });

    const searchFailure4 = this.checkNodeSuccess(searchResult4);
    if (searchFailure4) return searchFailure4;

    // Verify all results have score >= 0.8
    const assets4 = searchResult4.data!.searchCampaignAssets!.assets;
    for (const result of assets4) {
      if (result.score < 0.8) {
        return this.createFailureResult(
          searchNode4.nodeId,
          `Expected all scores >= 0.8, got ${result.score} for ${result.asset.name}`
        );
      }
    }

    // Step 8: Cleanup - Delete campaign (cascades to assets)
    const deleteCampaignNode = new DeleteCampaignNode(
      this.server,
      this.authToken
    );
    const deleteCampaignResult = await this.executeNode(deleteCampaignNode, {
      campaignId,
    });

    const deleteCampaignFailure = this.checkNodeSuccess(deleteCampaignResult);
    if (deleteCampaignFailure) return deleteCampaignFailure;

    // Restore mocks
    mock.restore();

    // All steps succeeded!
    return this.createSuccessResult();
  }
}
