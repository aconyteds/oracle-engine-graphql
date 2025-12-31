import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for GetCampaignAssetNode
 */
export type GetCampaignAssetInput = {
  assetId: string;
  recordType?: "Location" | "NPC" | "Plot";
};

/**
 * Output from GetCampaignAssetNode
 */
export type GetCampaignAssetOutput = {
  getCampaignAsset: {
    asset: {
      id: string;
      campaignId: string;
      name: string;
      recordType: string;
      gmSummary: string | null;
      gmNotes: string | null;
      playerSummary: string | null;
      playerNotes: string | null;
      data:
        | {
            __typename: "LocationData";
            imageUrl: string | null;
            description: string;
            condition: string;
            pointsOfInterest: string;
            characters: string;
          }
        | {
            __typename: "NPCData";
            imageUrl: string | null;
            physicalDescription: string;
            motivation: string;
            mannerisms: string;
          }
        | {
            __typename: "PlotData";
            status: string;
            urgency: string;
          };
      createdAt: string;
      updatedAt: string;
    } | null;
  };
};

/**
 * Node for retrieving a single campaign asset.
 * Requires authentication and asset ownership.
 */
export class GetCampaignAssetNode extends BaseNode<
  GetCampaignAssetInput,
  GetCampaignAssetOutput
> {
  readonly nodeId = "GetCampaignAssetNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: GetCampaignAssetInput
  ): Promise<NodeResult<GetCampaignAssetOutput>> {
    const query = `
      query GetCampaignAsset($input: GetCampaignAssetInput!) {
        getCampaignAsset(input: $input) {
          asset {
            id
            campaignId
            name
            recordType
            gmSummary
            gmNotes
            playerSummary
            playerNotes
            data {
              __typename
              ... on LocationData {
                imageUrl
                description
                condition
                pointsOfInterest
                characters
              }
              ... on NPCData {
                imageUrl
                physicalDescription
                motivation
                mannerisms
              }
              ... on PlotData {
                status
                urgency
              }
            }
            createdAt
            updatedAt
          }
        }
      }
    `;

    const result = await this.executeGraphQL<GetCampaignAssetOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "getCampaignAsset");

      // Verify asset was retrieved
      const assetData = result.data?.getCampaignAsset?.asset;
      expect(assetData).toBeDefined();
      expect(assetData?.id).toBe(input.assetId);

      // Verify type-specific data is present
      expect(assetData?.data).toBeDefined();
      expect(assetData?.data.__typename).toBeDefined();

      // If recordType was specified, verify it matches
      if (input.recordType) {
        expect(assetData?.recordType).toBe(input.recordType);
        expect(assetData?.data.__typename).toBe(`${input.recordType}Data`);
      }
    }

    return result;
  }
}
