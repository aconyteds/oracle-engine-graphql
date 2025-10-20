import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for DeleteCampaignNode
 */
export type DeleteCampaignInput = {
  campaignId: string;
};

/**
 * Output from DeleteCampaignNode
 */
export type DeleteCampaignOutput = {
  deleteCampaign: {
    success: boolean;
    campaignId: string;
  } | null;
};

/**
 * Node for deleting a campaign.
 * Requires authentication and ownership of the campaign.
 */
export class DeleteCampaignNode extends BaseNode<
  DeleteCampaignInput,
  DeleteCampaignOutput
> {
  readonly nodeId = "DeleteCampaignNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: DeleteCampaignInput
  ): Promise<NodeResult<DeleteCampaignOutput>> {
    const query = `
      mutation DeleteCampaign($input: DeleteCampaignInput!) {
        deleteCampaign(input: $input) {
          success
          campaignId
        }
      }
    `;

    const result = await this.executeGraphQL<DeleteCampaignOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "deleteCampaign");

      // Verify campaign was deleted
      const deleteData = result.data?.deleteCampaign;
      expect(deleteData).toBeDefined();
      expect(deleteData?.success).toBe(true);
      expect(deleteData?.campaignId).toBe(input.campaignId);
    }

    return result;
  }
}
