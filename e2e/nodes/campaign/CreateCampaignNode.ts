import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for CreateCampaignNode
 */
export type CreateCampaignInput = {
  name: string;
  setting: string;
  tone: string;
  ruleset: string;
};

/**
 * Output from CreateCampaignNode
 */
export type CreateCampaignOutput = {
  createCampaign: {
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
 * Node for creating a new campaign.
 * Requires authentication.
 */
export class CreateCampaignNode extends BaseNode<
  CreateCampaignInput,
  CreateCampaignOutput
> {
  readonly nodeId = "CreateCampaignNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: CreateCampaignInput
  ): Promise<NodeResult<CreateCampaignOutput>> {
    const query = `
      mutation CreateCampaign($input: CreateCampaignInput!) {
        createCampaign(input: $input) {
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

    const result = await this.executeGraphQL<CreateCampaignOutput>(query, {
      input,
    });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "createCampaign");

      // Verify campaign was created with expected data
      const campaignData = result.data?.createCampaign?.campaign;
      expect(campaignData).toBeDefined();
      expect(campaignData?.name).toBe(input.name);
      expect(campaignData?.setting).toBe(input.setting);
      expect(campaignData?.tone).toBe(input.tone);
      expect(campaignData?.ruleset).toBe(input.ruleset);
    }

    return result;
  }
}
