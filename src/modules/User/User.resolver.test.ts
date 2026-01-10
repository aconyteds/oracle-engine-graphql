import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { UsageStatus } from "../../data/RateLimiting/usageTracking";
import type { UserModule } from "./generated";

describe("User Resolvers", () => {
  // Mock variables
  let mockCheckRateLimit: ReturnType<typeof mock>;
  let UserResolvers: typeof import("./User.resolver").default;

  // Default mock data - matches what getCurrentUser returns (UserModule.User)
  const defaultUser: UserModule.User = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    isActive: true,
    subscriptionTier: "Free",
  };

  const defaultUsageStatus: UsageStatus = {
    currentCount: 10,
    maxCount: 25,
    remaining: 15,
    isAtLimit: false,
    isNearLimit: false,
    percentUsed: 0.4,
  };

  beforeEach(async () => {
    // Restore all mocks
    mock.restore();

    // Create fresh mock instances
    mockCheckRateLimit = mock();

    // Set up module mocks
    mock.module("../../data/RateLimiting/usageTracking", () => ({
      checkRateLimit: mockCheckRateLimit,
    }));

    // Dynamically import the module under test
    const module = await import("./User.resolver");
    UserResolvers = module.default;

    // Configure default mock behavior
    mockCheckRateLimit.mockResolvedValue(defaultUsageStatus);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("User.dailyUsage", () => {
    test("Unit -> dailyUsage returns usage data with limit", async () => {
      const resolver = UserResolvers.User?.dailyUsage;
      expect(resolver).toBeDefined();

      if (resolver && typeof resolver === "function") {
        const result = await resolver(
          defaultUser,
          {},
          {} as never,
          {} as never
        );

        expect(mockCheckRateLimit).toHaveBeenCalledWith("user-123");
        expect(result).toEqual({
          current: 10,
          limit: 25,
          percentUsed: 0.4,
        });
      }
    });

    test("Unit -> dailyUsage returns null limit for unlimited tier", async () => {
      mockCheckRateLimit.mockResolvedValue({
        ...defaultUsageStatus,
        maxCount: -1,
        remaining: -1,
      });

      const resolver = UserResolvers.User?.dailyUsage;

      if (resolver && typeof resolver === "function") {
        const result = await resolver(
          defaultUser,
          {},
          {} as never,
          {} as never
        );

        expect(result).toEqual({
          current: 10,
          limit: null,
          percentUsed: 0.4,
        });
      }
    });

    test("Unit -> dailyUsage handles user at limit", async () => {
      mockCheckRateLimit.mockResolvedValue({
        currentCount: 25,
        maxCount: 25,
        remaining: 0,
        isAtLimit: true,
        isNearLimit: false,
        percentUsed: 1.0,
      });

      const resolver = UserResolvers.User?.dailyUsage;

      if (resolver && typeof resolver === "function") {
        const result = await resolver(
          defaultUser,
          {},
          {} as never,
          {} as never
        );

        expect(result).toEqual({
          current: 25,
          limit: 25,
          percentUsed: 1.0,
        });
      }
    });

    test("Unit -> dailyUsage handles user near limit", async () => {
      mockCheckRateLimit.mockResolvedValue({
        currentCount: 21,
        maxCount: 25,
        remaining: 4,
        isAtLimit: false,
        isNearLimit: true,
        percentUsed: 0.84,
      });

      const resolver = UserResolvers.User?.dailyUsage;

      if (resolver && typeof resolver === "function") {
        const result = await resolver(
          defaultUser,
          {},
          {} as never,
          {} as never
        );

        expect(result).toEqual({
          current: 21,
          limit: 25,
          percentUsed: 0.84,
        });
      }
    });

    test("Unit -> dailyUsage handles zero usage", async () => {
      mockCheckRateLimit.mockResolvedValue({
        currentCount: 0,
        maxCount: 100,
        remaining: 100,
        isAtLimit: false,
        isNearLimit: false,
        percentUsed: 0.0,
      });

      const resolver = UserResolvers.User?.dailyUsage;

      if (resolver && typeof resolver === "function") {
        const result = await resolver(
          defaultUser,
          {},
          {} as never,
          {} as never
        );

        expect(result).toEqual({
          current: 0,
          limit: 100,
          percentUsed: 0.0,
        });
      }
    });
  });
});
