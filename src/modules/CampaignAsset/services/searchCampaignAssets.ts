import {
  AssetSearchInput,
  searchCampaignAssets as searchAssets,
} from "../../../data/MongoDB/campaignAsset";
import { InvalidInput } from "../../../graphql/errors";
import { CampaignAssetModule } from "../generated";
import { translateCampaignAsset } from "../translators";

export async function searchCampaignAssets(
  input: CampaignAssetModule.SearchCampaignAssetsInput
): Promise<CampaignAssetModule.SearchCampaignAssetsPayload> {
  // Validate the input
  if (!input.query && !input.keywords) {
    throw InvalidInput(
      "At least one of 'query' or 'keywords' must be provided for searching campaign assets."
    );
  }

  const params: AssetSearchInput = {
    campaignId: input.campaignId,
    ...(input.query && { query: input.query }),
    ...(input.keywords && { keywords: input.keywords }),
    ...(input.recordType && { recordType: input.recordType }),
    ...(input.limit !== null &&
      input.limit !== undefined && { limit: input.limit }),
    ...(input.minScore !== null &&
      input.minScore !== undefined && { minScore: input.minScore }),
  };
  const { assets } = await searchAssets(params);
  // Transform results to include score
  return {
    assets: assets.map((result) => ({
      asset: translateCampaignAsset(result),
      score: result.score ?? 0,
    })),
  };
}
