import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for CreateCampaignAssetNode
 */
export type CreateCampaignAssetInput = {
  campaignId: string;
  recordType: "Location" | "NPC" | "Plot";
  name: string;
  gmSummary?: string;
  gmNotes?: string;
  playerSummary?: string;
  playerNotes?: string;
  locationData?: {
    imageUrl?: string;
    description: string;
    condition: string;
    pointsOfInterest: string;
    characters: string;
  };
  npcData?: {
    imageUrl?: string;
    physicalDescription: string;
    motivation: string;
    mannerisms: string;
  };
  plotData?: {
    status: "Unknown" | "Rumored" | "InProgress" | "WillNotDo" | "Closed";
    urgency: "Ongoing" | "TimeSensitive" | "Critical" | "Resolved";
  };
};

/**
 * Output from CreateCampaignAssetNode
 */
export type CreateCampaignAssetOutput = {
  createCampaignAsset: {
    asset: {
      id: string;
      campaignId: string;
      name: string;
      recordType: string;
      gmSummary: string | null;
      playerSummary: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
};

/**
 * Node for creating a new campaign asset (Location, NPC, or Plot).
 * Requires authentication and campaign ownership.
 */
export class CreateCampaignAssetNode extends BaseNode<
  CreateCampaignAssetInput,
  CreateCampaignAssetOutput
> {
  readonly nodeId = "CreateCampaignAssetNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: CreateCampaignAssetInput
  ): Promise<NodeResult<CreateCampaignAssetOutput>> {
    const query = `
      mutation CreateCampaignAsset($input: CreateCampaignAssetInput!) {
        createCampaignAsset(input: $input) {
          asset {
            id
            campaignId
            name
            recordType
            gmSummary
            playerSummary
            createdAt
            updatedAt
          }
        }
      }
    `;

    const result = await this.executeGraphQL<CreateCampaignAssetOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "createCampaignAsset");

      // Verify asset was created with expected data
      const assetData = result.data?.createCampaignAsset?.asset;
      expect(assetData).toBeDefined();
      expect(assetData?.campaignId).toBe(input.campaignId);
      expect(assetData?.name).toBe(input.name);
      expect(assetData?.recordType).toBe(input.recordType);
      expect(assetData?.id).toBeDefined();
      expect(assetData?.createdAt).toBeDefined();
      expect(assetData?.updatedAt).toBeDefined();

      // Verify optional fields if provided
      if (input.gmSummary !== undefined) {
        expect(assetData?.gmSummary).toBe(input.gmSummary);
      }
      if (input.playerSummary !== undefined) {
        expect(assetData?.playerSummary).toBe(input.playerSummary);
      }
    }

    return result;
  }
}
