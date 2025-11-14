import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for DeleteCampaignAssetNode
 */
export type DeleteCampaignAssetInput = {
  assetId: string;
};

/**
 * Output from DeleteCampaignAssetNode
 */
export type DeleteCampaignAssetOutput = {
  deleteCampaignAsset: {
    success: boolean;
    assetId: string;
  };
};

/**
 * Node for deleting a campaign asset.
 * Requires authentication and asset ownership.
 */
export class DeleteCampaignAssetNode extends BaseNode<
  DeleteCampaignAssetInput,
  DeleteCampaignAssetOutput
> {
  readonly nodeId = "DeleteCampaignAssetNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: DeleteCampaignAssetInput
  ): Promise<NodeResult<DeleteCampaignAssetOutput>> {
    const query = `
      mutation DeleteCampaignAsset($input: DeleteCampaignAssetInput!) {
        deleteCampaignAsset(input: $input) {
          success
          assetId
        }
      }
    `;

    const result = await this.executeGraphQL<DeleteCampaignAssetOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "deleteCampaignAsset");

      // Verify deletion was successful
      const deleteData = result.data?.deleteCampaignAsset;
      expect(deleteData).toBeDefined();
      expect(deleteData?.success).toBe(true);
      expect(deleteData?.assetId).toBe(input.assetId);
    }

    return result;
  }
}
