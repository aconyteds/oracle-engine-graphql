import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for SearchCampaignAssetsNode
 */
export type SearchCampaignAssetsInput = {
  campaignId: string;
  query: string;
  recordType?: "Location" | "NPC" | "Plot";
  limit?: number;
  minScore?: number;
};

/**
 * Output from SearchCampaignAssetsNode
 */
export type SearchCampaignAssetsOutput = {
  searchCampaignAssets: {
    assets: Array<{
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
      score: number;
    }>;
  };
};

/**
 * Node for searching campaign assets using natural language queries.
 * Uses vector similarity search to find relevant assets.
 * Requires authentication and campaign ownership.
 */
export class SearchCampaignAssetsNode extends BaseNode<
  SearchCampaignAssetsInput,
  SearchCampaignAssetsOutput
> {
  readonly nodeId = "SearchCampaignAssetsNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: SearchCampaignAssetsInput
  ): Promise<NodeResult<SearchCampaignAssetsOutput>> {
    const query = `
      query SearchCampaignAssets($input: SearchCampaignAssetsInput!) {
        searchCampaignAssets(input: $input) {
          assets {
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
            score
          }
        }
      }
    `;

    const result = await this.executeGraphQL<SearchCampaignAssetsOutput>(
      query,
      {
        input,
      }
    );

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "searchCampaignAssets");

      // Verify assets array exists
      const searchResults = result.data?.searchCampaignAssets?.assets;
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);

      if (searchResults) {
        // Verify all assets belong to the correct campaign
        for (const searchResult of searchResults) {
          expect(searchResult.asset.campaignId).toBe(input.campaignId);

          // Verify score is a valid number between 0 and 1
          expect(typeof searchResult.score).toBe("number");
          expect(searchResult.score).toBeGreaterThanOrEqual(0);
          expect(searchResult.score).toBeLessThanOrEqual(1);

          // If recordType filter was specified, verify all assets match
          if (input.recordType) {
            expect(searchResult.asset.recordType).toBe(input.recordType);
          }
        }

        // Verify scores are in descending order (highest similarity first)
        for (let i = 0; i < searchResults.length - 1; i++) {
          expect(searchResults[i].score).toBeGreaterThanOrEqual(
            searchResults[i + 1].score
          );
        }

        // Verify limit is respected
        if (input.limit !== undefined && input.limit !== null) {
          expect(searchResults.length).toBeLessThanOrEqual(input.limit);
        }

        // Verify minScore filter is respected
        if (input.minScore !== undefined && input.minScore !== null) {
          for (const searchResult of searchResults) {
            expect(searchResult.score).toBeGreaterThanOrEqual(input.minScore);
          }
        }
      }
    }

    return result;
  }
}
