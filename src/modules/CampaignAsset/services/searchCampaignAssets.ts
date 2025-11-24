import {
  AssetSearchInput,
  captureSearchMetrics,
  searchCampaignAssets as searchAssets,
} from "../../../data/MongoDB/campaignAsset";
import { CampaignAssetModule } from "../generated";
import { translateCampaignAsset } from "../translators";

export async function searchCampaignAssets(
  input: CampaignAssetModule.SearchCampaignAssetsInput
): Promise<CampaignAssetModule.SearchCampaignAssetsPayload> {
  const params: AssetSearchInput = {
    campaignId: input.campaignId,
    query: input.query,
    ...(input.recordType && { recordType: input.recordType }),
    ...(input.limit !== null &&
      input.limit !== undefined && { limit: input.limit }),
    ...(input.minScore !== null &&
      input.minScore !== undefined && { minScore: input.minScore }),
  };
  const { assets, timings } = await searchAssets(params);

  // Capture metrics asynchronously (fire-and-forget)
  void (async () => {
    try {
      await captureSearchMetrics({
        searchInput: params,
        results: assets,
        timings,
      });
    } catch (error) {
      console.error("Search metrics capture failed:", error);
      // Never throw - metrics should not break search
    }
  })();
  // Transform results to include score
  return {
    assets: assets.map((result) => ({
      asset: translateCampaignAsset(result),
      score: result.score ?? 0,
    })),
  };
}
