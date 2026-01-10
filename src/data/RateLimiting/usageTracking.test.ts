import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { DailyUsage, User } from "@prisma/client";

describe("usageTracking", () => {
  // Mock variables
  let mockUpsert: ReturnType<typeof mock>;
  let mockCount: ReturnType<typeof mock>;
  let mockUserFindUnique: ReturnType<typeof mock>;
  let mockSentryCapture: ReturnType<typeof mock>;
  let mockDBClient: {
    dailyUsage: {
      upsert: ReturnType<typeof mock>;
    };
    campaign: {
      count: ReturnType<typeof mock>;
    };
    user: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let getCurrentDateString: typeof import("./usageTracking").getCurrentDateString;
  let getOrCreateDailyUsage: typeof import("./usageTracking").getOrCreateDailyUsage;
  let incrementLLMUsage: typeof import("./usageTracking").incrementLLMUsage;
  let getTierLimits: typeof import("./usageTracking").getTierLimits;
  let checkRateLimit: typeof import("./usageTracking").checkRateLimit;
  let checkCampaignLimit: typeof import("./usageTracking").checkCampaignLimit;

  // Default mock data
  const defaultUserId = "user-123";
  const defaultDate = "2025-01-08";
  const defaultDailyUsage: DailyUsage = {
    id: "usage-1",
    userId: defaultUserId,
    date: defaultDate,
    llmCallCount: 0,
    tokenCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mock.restore();

    // Create fresh mock instances
    mockUpsert = mock();
    mockCount = mock();
    mockUserFindUnique = mock();
    mockSentryCapture = mock();
    mockDBClient = {
      dailyUsage: {
        upsert: mockUpsert,
      },
      campaign: {
        count: mockCount,
      },
      user: {
        findUnique: mockUserFindUnique,
      },
    };

    // Set up module mocks
    mock.module("../MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("@sentry/bun", () => ({
      captureException: mockSentryCapture,
    }));

    // Dynamically import the module under test
    const module = await import("./usageTracking");
    getCurrentDateString = module.getCurrentDateString;
    getOrCreateDailyUsage = module.getOrCreateDailyUsage;
    incrementLLMUsage = module.incrementLLMUsage;
    getTierLimits = module.getTierLimits;
    checkRateLimit = module.checkRateLimit;
    checkCampaignLimit = module.checkCampaignLimit;

    // Configure default mock behavior
    mockUpsert.mockResolvedValue(defaultDailyUsage);
    mockCount.mockResolvedValue(0);
    mockUserFindUnique.mockResolvedValue({ subscriptionTier: "Free" } as User);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("getCurrentDateString", () => {
    test("Unit -> getCurrentDateString returns date in YYYY-MM-DD format", () => {
      const result = getCurrentDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("Unit -> getCurrentDateString returns current date", () => {
      const result = getCurrentDateString();
      const expected = new Date().toISOString().split("T")[0];
      expect(result).toBe(expected);
    });
  });

  describe("getOrCreateDailyUsage", () => {
    test("Unit -> getOrCreateDailyUsage creates new record if not exists", async () => {
      const result = await getOrCreateDailyUsage(defaultUserId);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          userId_date: { userId: defaultUserId, date: expect.any(String) },
        },
        create: {
          userId: defaultUserId,
          date: expect.any(String),
          llmCallCount: 0,
          tokenCount: 0,
        },
        update: {},
      });
      expect(result).toEqual(defaultDailyUsage);
    });

    test("Unit -> getOrCreateDailyUsage returns existing record", async () => {
      const existingUsage = { ...defaultDailyUsage, llmCallCount: 10 };
      mockUpsert.mockResolvedValue(existingUsage);

      const result = await getOrCreateDailyUsage(defaultUserId);

      expect(result.llmCallCount).toBe(10);
    });
  });

  describe("incrementLLMUsage", () => {
    test("Unit -> incrementLLMUsage increments llmCallCount", async () => {
      const incrementedUsage = { ...defaultDailyUsage, llmCallCount: 1 };
      mockUpsert.mockResolvedValue(incrementedUsage);

      const result = await incrementLLMUsage(defaultUserId);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          userId_date: { userId: defaultUserId, date: expect.any(String) },
        },
        create: {
          userId: defaultUserId,
          date: expect.any(String),
          llmCallCount: 1,
          tokenCount: 0,
        },
        update: {
          llmCallCount: { increment: 1 },
        },
      });
      expect(result.llmCallCount).toBe(1);
    });

    test("Unit -> incrementLLMUsage increments tokenCount when provided", async () => {
      const incrementedUsage = {
        ...defaultDailyUsage,
        llmCallCount: 1,
        tokenCount: 500,
      };
      mockUpsert.mockResolvedValue(incrementedUsage);

      const result = await incrementLLMUsage(defaultUserId, 500);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          userId_date: { userId: defaultUserId, date: expect.any(String) },
        },
        create: {
          userId: defaultUserId,
          date: expect.any(String),
          llmCallCount: 1,
          tokenCount: 500,
        },
        update: {
          llmCallCount: { increment: 1 },
          tokenCount: { increment: 500 },
        },
      });
      expect(result.tokenCount).toBe(500);
    });
  });

  describe("getTierLimits", () => {
    test.each([
      {
        tier: "Free",
        expected: {
          maxLLMCallsPerDay: 25,
          maxCampaigns: 1,
          warningThreshold: 0.8,
          displayName: "Free",
        },
      },
      {
        tier: "Tier1",
        expected: {
          maxLLMCallsPerDay: 100,
          maxCampaigns: 5,
          warningThreshold: 0.8,
          displayName: "Hobbyist",
        },
      },
      {
        tier: "Tier2",
        expected: {
          maxLLMCallsPerDay: 500,
          maxCampaigns: 20,
          warningThreshold: 0.8,
          displayName: "Game Master",
        },
      },
      {
        tier: "Tier3",
        expected: {
          maxLLMCallsPerDay: 1000,
          maxCampaigns: -1,
          warningThreshold: 0.8,
          displayName: "Professional",
        },
      },
      {
        tier: "Admin",
        expected: {
          maxLLMCallsPerDay: -1,
          maxCampaigns: -1,
          warningThreshold: 1.0,
          displayName: "Admin",
        },
      },
    ])(
      "Unit -> getTierLimits returns correct limits for $tier user",
      async ({ tier, expected }) => {
        mockUserFindUnique.mockResolvedValue({
          subscriptionTier: tier,
        } as User);

        const limits = await getTierLimits("user-1");

        expect(limits.maxLLMCallsPerDay).toBe(expected.maxLLMCallsPerDay);
        expect(limits.maxCampaigns).toBe(expected.maxCampaigns);
        expect(limits.warningThreshold).toBe(expected.warningThreshold);
        expect(limits.displayName).toBe(expected.displayName);
      }
    );

    test("Unit -> getTierLimits returns safe default for non-existent user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const limits = await getTierLimits("invalid-user");

      expect(mockSentryCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User not found when checking rate limits",
        }),
        {
          extra: {
            userId: "invalid-user",
            reminder:
              "This error likely means that an invalid UserId was passed to this method, indicating an incorrect implementation where userId doesn't exist. Double check the call chain to ensure the userId has been verified.",
          },
        }
      );

      expect(limits).toEqual({
        maxLLMCallsPerDay: 0,
        maxCampaigns: 0,
        warningThreshold: 0.8,
        displayName: "Unknown",
      });
    });
  });

  describe("checkRateLimit", () => {
    test("Unit -> checkRateLimit returns unlimited status for Admin tier", async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: "Admin",
      } as User);

      const result = await checkRateLimit(defaultUserId);

      expect(result).toEqual({
        currentCount: 0,
        maxCount: -1,
        remaining: -1,
        isAtLimit: false,
        isNearLimit: false,
        percentUsed: 0,
      });
      // Should not query database for unlimited tier
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    test("Unit -> checkRateLimit returns correct status when under limit", async () => {
      mockUpsert.mockResolvedValue({ ...defaultDailyUsage, llmCallCount: 10 });

      const result = await checkRateLimit(defaultUserId);

      expect(result).toEqual({
        currentCount: 10,
        maxCount: 25,
        remaining: 15,
        isAtLimit: false,
        isNearLimit: false,
        percentUsed: 0.4,
      });
    });

    test("Unit -> checkRateLimit returns isNearLimit when at 80% or more", async () => {
      mockUpsert.mockResolvedValue({ ...defaultDailyUsage, llmCallCount: 20 });

      const result = await checkRateLimit(defaultUserId);

      expect(result.isNearLimit).toBe(true);
      expect(result.isAtLimit).toBe(false);
      expect(result.percentUsed).toBe(0.8);
    });

    test("Unit -> checkRateLimit returns isAtLimit when at limit", async () => {
      mockUpsert.mockResolvedValue({ ...defaultDailyUsage, llmCallCount: 25 });

      const result = await checkRateLimit(defaultUserId);

      expect(result.isAtLimit).toBe(true);
      expect(result.isNearLimit).toBe(false); // isNearLimit should be false when AT limit
      expect(result.remaining).toBe(0);
    });

    test("Unit -> checkRateLimit returns isAtLimit when over limit", async () => {
      mockUpsert.mockResolvedValue({ ...defaultDailyUsage, llmCallCount: 30 });

      const result = await checkRateLimit(defaultUserId);

      expect(result.isAtLimit).toBe(true);
      expect(result.remaining).toBe(0);
    });

    test("Unit -> checkRateLimit returns limit exceeded for non-existent user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await checkRateLimit(defaultUserId);

      expect(result).toEqual({
        currentCount: 0,
        maxCount: 0,
        remaining: 0,
        isAtLimit: true,
        isNearLimit: false,
        percentUsed: 1,
      });
    });
  });

  describe("checkCampaignLimit", () => {
    test("Unit -> checkCampaignLimit returns unlimited for Admin tier", async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: "Admin",
      } as User);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: true,
        current: 0,
        max: -1,
      });
      expect(mockCount).not.toHaveBeenCalled();
    });

    test("Unit -> checkCampaignLimit returns unlimited for Tier3", async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: "Tier3",
      } as User);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: true,
        current: 0,
        max: -1,
      });
      expect(mockCount).not.toHaveBeenCalled();
    });

    test("Unit -> checkCampaignLimit returns canCreate true when under limit", async () => {
      mockCount.mockResolvedValue(0);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: true,
        current: 0,
        max: 1,
      });
    });

    test("Unit -> checkCampaignLimit returns canCreate false when at limit", async () => {
      mockCount.mockResolvedValue(1);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: false,
        current: 1,
        max: 1,
      });
    });

    test("Unit -> checkCampaignLimit handles Tier1 with 5 campaigns", async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: "Tier1",
      } as User);
      mockCount.mockResolvedValue(4);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: true,
        current: 4,
        max: 5,
      });
    });

    test("Unit -> checkCampaignLimit blocks when Tier1 has 5 campaigns", async () => {
      mockUserFindUnique.mockResolvedValue({
        subscriptionTier: "Tier1",
      } as User);
      mockCount.mockResolvedValue(5);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: false,
        current: 5,
        max: 5,
      });
    });

    test("Unit -> checkCampaignLimit returns cannot create for non-existent user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await checkCampaignLimit(defaultUserId);

      expect(result).toEqual({
        canCreate: false,
        current: 0,
        max: 0,
      });
    });
  });
});
