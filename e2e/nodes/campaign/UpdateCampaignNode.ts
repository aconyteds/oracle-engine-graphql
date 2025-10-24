import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for UpdateCampaignNode
 */
export type UpdateCampaignInput = {
  campaignId: string;
  name?: string;
  setting?: string;
  tone?: string;
  ruleset?: string;
};

/**
 * Output from UpdateCampaignNode
 */
export type UpdateCampaignOutput = {
  updateCampaign: {
    campaign: {
      id: string;
      ownerId: string;
      name: string;
      setting: string;
      tone: string;
      ruleset: string;
      createdAt: string;
      updatedAt: string;
    } | null;
  } | null;
};

/**
 * Node for updating an existing campaign.
 * Requires authentication and ownership of the campaign.
 */
export class UpdateCampaignNode extends BaseNode<
  UpdateCampaignInput,
  UpdateCampaignOutput
> {
  readonly nodeId = "UpdateCampaignNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: UpdateCampaignInput
  ): Promise<NodeResult<UpdateCampaignOutput>> {
    const query = `
      mutation UpdateCampaign($input: UpdateCampaignInput!) {
        updateCampaign(input: $input) {
          campaign {
            id
            ownerId
            name
            setting
            tone
            ruleset
            createdAt
            updatedAt
          }
        }
      }
    `;

    const result = await this.executeGraphQL<UpdateCampaignOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "updateCampaign");

      // Verify campaign was updated
      const campaignData = result.data?.updateCampaign?.campaign;
      expect(campaignData).toBeDefined();
      expect(campaignData?.id).toBe(input.campaignId);
    }

    return result;
  }
}
