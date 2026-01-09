import type { SubscriptionTier } from "@prisma/client";

export interface TierLimits {
  maxLLMCallsPerDay: number;
  maxCampaigns: number;
  warningThreshold: number; // Percentage (0.8 = 80%)
  displayName: string;
  priceMonthly?: number; // USD
}

/**
 * Rate limit configuration for each subscription tier.
 * Use -1 to indicate unlimited.
 */
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  Free: {
    maxLLMCallsPerDay: 25,
    maxCampaigns: 1,
    warningThreshold: 0.8,
    displayName: "Free",
    priceMonthly: 0,
  },
  Tier1: {
    maxLLMCallsPerDay: 100,
    maxCampaigns: 5,
    warningThreshold: 0.8,
    displayName: "Hobbyist",
    priceMonthly: 9.99,
  },
  Tier2: {
    maxLLMCallsPerDay: 500,
    maxCampaigns: 20,
    warningThreshold: 0.8,
    displayName: "Game Master",
    priceMonthly: 24.99,
  },
  Tier3: {
    maxLLMCallsPerDay: 1000,
    maxCampaigns: -1, // Unlimited
    warningThreshold: 0.8,
    displayName: "Professional",
    priceMonthly: 49.99,
  },
  Admin: {
    maxLLMCallsPerDay: -1, // Unlimited
    maxCampaigns: -1, // Unlimited
    warningThreshold: 1.0, // No warning for unlimited
    displayName: "Admin",
  },
};

/**
 * Get the rate limits for a subscription tier.
 */
export const getTierLimits = (tier: SubscriptionTier): TierLimits => {
  return TIER_LIMITS[tier];
};

/**
 * Check if a limit value represents unlimited (-1).
 */
export const isUnlimited = (limit: number): boolean => {
  return limit === -1;
};
