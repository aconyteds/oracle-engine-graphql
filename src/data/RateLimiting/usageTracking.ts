import type { DailyUsage } from "@prisma/client";
import * as Sentry from "@sentry/bun";
import { DBClient } from "../MongoDB";
import { isUnlimited, TIER_LIMITS, TierLimits } from "./config";

export interface UsageStatus {
  currentCount: number;
  maxCount: number;
  remaining: number;
  isAtLimit: boolean;
  isNearLimit: boolean; // Above warning threshold but not at limit
  percentUsed: number;
}

export interface CampaignLimitStatus {
  canCreate: boolean;
  current: number;
  max: number;
}

const RATE_LIMIT_EXCEEDED: UsageStatus = {
  currentCount: 0,
  maxCount: 0,
  remaining: 0,
  isAtLimit: true,
  isNearLimit: false,
  percentUsed: 1,
} as const;

const CAMPAIGN_LIMIT_EXCEEDED: CampaignLimitStatus = {
  canCreate: false,
  current: 0,
  max: 0,
} as const;

/**
 * Gets the current UTC date string in YYYY-MM-DD format.
 */
export const getCurrentDateString = (): string => {
  return new Date().toISOString().split("T")[0];
};

/**
 * Gets or creates a DailyUsage record for the user and current date.
 * Uses upsert for atomic operation.
 */
export const getOrCreateDailyUsage = async (
  userId: string
): Promise<DailyUsage> => {
  const date = getCurrentDateString();

  const usage = await DBClient.dailyUsage.upsert({
    where: {
      userId_date: { userId, date },
    },
    create: {
      userId,
      date,
      llmCallCount: 0,
      tokenCount: 0,
    },
    update: {}, // No update needed, just retrieve
  });

  return usage;
};

/**
 * Increments LLM usage count and optionally token count.
 * Uses upsert with atomic increment for thread-safety.
 */
export const incrementLLMUsage = async (
  userId: string,
  tokenCount?: number
): Promise<DailyUsage> => {
  const date = getCurrentDateString();

  const usage = await DBClient.dailyUsage.upsert({
    where: {
      userId_date: { userId, date },
    },
    create: {
      userId,
      date,
      llmCallCount: 1,
      tokenCount: tokenCount ?? 0,
    },
    update: {
      llmCallCount: { increment: 1 },
      ...(tokenCount !== undefined && {
        tokenCount: { increment: tokenCount },
      }),
    },
  });

  return usage;
};

/**
 * Checks the current rate limit status for a user.
 */
export const checkRateLimit = async (userId: string): Promise<UsageStatus> => {
  const limits = await getTierLimits(userId);

  // Unlimited case
  if (isUnlimited(limits.maxLLMCallsPerDay)) {
    return {
      currentCount: 0,
      maxCount: -1,
      remaining: -1,
      isAtLimit: false,
      isNearLimit: false,
      percentUsed: 0,
    };
  }

  // If maxLLMCallsPerDay is 0, user not found - return safe default
  if (limits.maxLLMCallsPerDay === 0) {
    return RATE_LIMIT_EXCEEDED;
  }

  const usage = await getOrCreateDailyUsage(userId);
  const currentCount = usage.llmCallCount;
  const maxCount = limits.maxLLMCallsPerDay;
  const remaining = Math.max(0, maxCount - currentCount);
  const percentUsed = currentCount / maxCount;

  return {
    currentCount,
    maxCount,
    remaining,
    isAtLimit: currentCount >= maxCount,
    isNearLimit:
      percentUsed >= limits.warningThreshold && currentCount < maxCount,
    percentUsed,
  };
};

/**
 * Checks if the user can create more campaigns based on their subscription tier.
 */
export const checkCampaignLimit = async (
  userId: string
): Promise<CampaignLimitStatus> => {
  const limits = await getTierLimits(userId);

  // Unlimited case
  if (isUnlimited(limits.maxCampaigns)) {
    return { canCreate: true, current: 0, max: -1 };
  }

  // If maxCampaigns is 0, user not found - return safe default
  if (limits.maxCampaigns === 0) {
    return CAMPAIGN_LIMIT_EXCEEDED;
  }

  const campaignCount = await DBClient.campaign.count({
    where: { ownerId: userId },
  });

  return {
    canCreate: campaignCount < limits.maxCampaigns,
    current: campaignCount,
    max: limits.maxCampaigns,
  };
};

/**
 * Get the rate limits for a user by userId.
 * Fetches the user's subscription tier and returns the corresponding limits.
 * Returns a safe default (no usage allowed) if the user is not found.
 */
export async function getTierLimits(userId: string): Promise<TierLimits> {
  const user = await DBClient.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  if (!user) {
    Sentry.captureException(
      new Error("User not found when checking rate limits"),
      {
        extra: {
          userId,
          reminder:
            "This error likely means that an invalid UserId was passed to this method, indicating an incorrect implementation where userId doesn't exist. Double check the call chain to ensure the userId has been verified.",
        },
      }
    );

    // Safe default: no usage allowed
    return {
      maxLLMCallsPerDay: 0,
      maxCampaigns: 0,
      warningThreshold: 0.8,
      displayName: "Unknown",
    };
  }

  return TIER_LIMITS[user.subscriptionTier];
}
