import {
  AssetSearchInput,
  searchCampaignAssets as searchAssets,
} from "../../../data/MongoDB/campaignAsset";
import { InvalidInput, ServerError } from "../../../graphql/errors";
import { CampaignAssetModule } from "../generated";
import { translateCampaignAsset } from "../translators";
import { detectQueryIntent } from "./detectQueryIntent";

export async function searchCampaignAssets(
  input: CampaignAssetModule.SearchCampaignAssetsInput
): Promise<CampaignAssetModule.SearchCampaignAssetsPayload> {
  // Validate the input
  if (!input.query && !input.keywords) {
    throw InvalidInput(
      "At least one of 'query' or 'keywords' must be provided for searching campaign assets."
    );
  }

  // Smart routing: when query and keywords are identical, detect intent and route accordingly
  // This optimizes for UI search where the same value is passed to both fields
  let routedQuery = input.query;
  let routedKeywords = input.keywords;

  if (input.query && input.keywords && input.query === input.keywords) {
    const intent = detectQueryIntent(input.query);
    if (intent === "text") {
      // Name-like query: use text search only
      routedQuery = undefined;
    } else {
      // Descriptive query: use vector search only
      routedKeywords = undefined;
    }
  }

  const params: AssetSearchInput = {
    campaignId: input.campaignId,
    ...(routedQuery && { query: routedQuery }),
    ...(routedKeywords && { keywords: routedKeywords }),
    ...(input.recordType && { recordType: input.recordType }),
    ...(input.limit !== null &&
      input.limit !== undefined && { limit: input.limit }),
    ...(input.minScore !== null &&
      input.minScore !== undefined && { minScore: input.minScore }),
  };
  try {
    const { assets } = await searchAssets(params);
    // Transform results to include score
    return {
      assets: assets.map((result) => ({
        asset: translateCampaignAsset(result),
        score: result.score ?? 0,
      })),
    };
  } catch {
    throw ServerError("An error occurred while searching campaign assets.");
  }
}
