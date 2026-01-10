import { describe, expect, test } from "bun:test";
import { isUnlimited, TIER_LIMITS } from "./config";

describe("config", () => {
  describe("isUnlimited", () => {
    test("Unit -> isUnlimited returns true for -1", () => {
      expect(isUnlimited(-1)).toBe(true);
    });

    test("Unit -> isUnlimited returns false for positive numbers", () => {
      expect(isUnlimited(0)).toBe(false);
      expect(isUnlimited(1)).toBe(false);
      expect(isUnlimited(25)).toBe(false);
      expect(isUnlimited(1500)).toBe(false);
    });
  });

  describe("TIER_LIMITS", () => {
    test("Unit -> TIER_LIMITS contains all subscription tiers", () => {
      expect(TIER_LIMITS).toHaveProperty("Free");
      expect(TIER_LIMITS).toHaveProperty("Tier1");
      expect(TIER_LIMITS).toHaveProperty("Tier2");
      expect(TIER_LIMITS).toHaveProperty("Tier3");
      expect(TIER_LIMITS).toHaveProperty("Admin");
    });

    test("Unit -> TIER_LIMITS tiers have increasing LLM call limits", () => {
      expect(TIER_LIMITS.Free.maxLLMCallsPerDay).toBeLessThan(
        TIER_LIMITS.Tier1.maxLLMCallsPerDay
      );
      expect(TIER_LIMITS.Tier1.maxLLMCallsPerDay).toBeLessThan(
        TIER_LIMITS.Tier2.maxLLMCallsPerDay
      );
      expect(TIER_LIMITS.Tier2.maxLLMCallsPerDay).toBeLessThan(
        TIER_LIMITS.Tier3.maxLLMCallsPerDay
      );
    });

    test("Unit -> TIER_LIMITS tiers have increasing campaign limits", () => {
      expect(TIER_LIMITS.Free.maxCampaigns).toBeLessThan(
        TIER_LIMITS.Tier1.maxCampaigns
      );
      expect(TIER_LIMITS.Tier1.maxCampaigns).toBeLessThan(
        TIER_LIMITS.Tier2.maxCampaigns
      );
      // Tier3 is unlimited (-1), which is "greater" in terms of allowance
      expect(TIER_LIMITS.Tier3.maxCampaigns).toBe(-1);
    });
  });
});
