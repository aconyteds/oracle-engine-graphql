import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for UpdateCampaignAssetNode
 */
export type UpdateCampaignAssetInput = {
  assetId: string;
  recordType: "Location" | "NPC" | "Plot";
  name?: string;
  summary?: string;
  playerSummary?: string;
  locationData?: {
    imageUrl?: string;
    description: string;
    condition: string;
    pointsOfInterest: string;
    characters: string;
    dmNotes: string;
    sharedWithPlayers: string;
  };
  npcData?: {
    imageUrl?: string;
    physicalDescription: string;
    motivation: string;
    mannerisms: string;
    dmNotes: string;
    sharedWithPlayers: string;
  };
  plotData?: {
    dmNotes: string;
    sharedWithPlayers: string;
    status: "Unknown" | "Rumored" | "InProgress" | "WillNotDo" | "Closed";
    urgency: "Ongoing" | "TimeSensitive" | "Critical" | "Resolved";
  };
};

/**
 * Output from UpdateCampaignAssetNode
 */
export type UpdateCampaignAssetOutput = {
  updateCampaignAsset: {
    asset: {
      id: string;
      campaignId: string;
      name: string;
      recordType: string;
      summary: string | null;
      playerSummary: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
};

/**
 * Node for updating an existing campaign asset.
 * Requires authentication and asset ownership.
 */
export class UpdateCampaignAssetNode extends BaseNode<
  UpdateCampaignAssetInput,
  UpdateCampaignAssetOutput
> {
  readonly nodeId = "UpdateCampaignAssetNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: UpdateCampaignAssetInput
  ): Promise<NodeResult<UpdateCampaignAssetOutput>> {
    const query = `
      mutation UpdateCampaignAsset($input: UpdateCampaignAssetInput!) {
        updateCampaignAsset(input: $input) {
          asset {
            id
            campaignId
            name
            recordType
            summary
            playerSummary
            createdAt
            updatedAt
          }
        }
      }
    `;

    const result = await this.executeGraphQL<UpdateCampaignAssetOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "updateCampaignAsset");

      // Verify asset was updated
      const assetData = result.data?.updateCampaignAsset?.asset;
      expect(assetData).toBeDefined();
      expect(assetData?.id).toBe(input.assetId);
      expect(assetData?.recordType).toBe(input.recordType);

      // Verify updated fields if provided
      if (input.name !== undefined) {
        expect(assetData?.name).toBe(input.name);
      }
      if (input.summary !== undefined) {
        expect(assetData?.summary).toBe(input.summary);
      }
      if (input.playerSummary !== undefined) {
        expect(assetData?.playerSummary).toBe(input.playerSummary);
      }
    }

    return result;
  }
}
