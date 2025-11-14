import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for ListCampaignAssetsNode
 */
export type ListCampaignAssetsInput = {
  campaignId: string;
  recordType?: "Location" | "NPC" | "Plot";
};

/**
 * Output from ListCampaignAssetsNode
 */
export type ListCampaignAssetsOutput = {
  listCampaignAssets: {
    assets: Array<{
      id: string;
      campaignId: string;
      name: string;
      recordType: string;
      summary: string | null;
      playerSummary: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

/**
 * Node for listing campaign assets with optional type filtering.
 * Requires authentication and campaign ownership.
 */
export class ListCampaignAssetsNode extends BaseNode<
  ListCampaignAssetsInput,
  ListCampaignAssetsOutput
> {
  readonly nodeId = "ListCampaignAssetsNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: ListCampaignAssetsInput
  ): Promise<NodeResult<ListCampaignAssetsOutput>> {
    const query = `
      query ListCampaignAssets($input: ListCampaignAssetsInput!) {
        listCampaignAssets(input: $input) {
          assets {
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

    const result = await this.executeGraphQL<ListCampaignAssetsOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "listCampaignAssets");

      // Verify assets array exists
      const assetsData = result.data?.listCampaignAssets?.assets;
      expect(assetsData).toBeDefined();
      expect(Array.isArray(assetsData)).toBe(true);

      // If recordType filter was specified, verify all assets match
      if (input.recordType && assetsData) {
        for (const asset of assetsData) {
          expect(asset.recordType).toBe(input.recordType);
          expect(asset.campaignId).toBe(input.campaignId);
        }
      }

      // Verify all assets belong to the correct campaign
      if (assetsData) {
        for (const asset of assetsData) {
          expect(asset.campaignId).toBe(input.campaignId);
        }
      }
    }

    return result;
  }
}
