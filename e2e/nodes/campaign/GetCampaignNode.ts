import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for GetCampaignNode
 */
export type GetCampaignInput = {
  campaignId: string;
};

/**
 * Output from GetCampaignNode
 */
export type GetCampaignOutput = {
  getCampaign: {
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
 * Node for getting a campaign by ID.
 * Requires authentication.
 */
export class GetCampaignNode extends BaseNode<
  GetCampaignInput,
  GetCampaignOutput
> {
  readonly nodeId = "GetCampaignNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: GetCampaignInput
  ): Promise<NodeResult<GetCampaignOutput>> {
    const query = `
      query GetCampaign($input: GetCampaignInput!) {
        getCampaign(input: $input) {
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

    const result = await this.executeGraphQL<GetCampaignOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "getCampaign");

      // Verify campaign was retrieved
      const campaignData = result.data?.getCampaign?.campaign;
      expect(campaignData).toBeDefined();
      expect(campaignData?.id).toBe(input.campaignId);
    }

    return result;
  }
}
