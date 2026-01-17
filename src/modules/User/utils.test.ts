import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { User } from "@prisma/client";

describe("translateUserToGraphQLUser", () => {
  // Mock variables
  let mockENV: { PUBLIC_ALLOWED?: string };
  let translateUserToGraphQLUser: typeof import("./utils").translateUserToGraphQLUser;

  // Default mock Prisma User object
  const defaultPrismaUser: User = {
    id: "user-123",
    googleAccountId: "google-123",
    email: "test@example.com",
    name: "Test User",
    active: false,
    subscriptionTier: "Free",
    lastCampaignId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  beforeEach(async () => {
    // Restore all mocks
    mock.restore();

    // Create fresh mock ENV
    mockENV = {};

    // Set up module mocks
    mock.module("../../config/environment", () => ({
      ENV: mockENV,
    }));

    // Dynamically import the module under test
    const module = await import("./utils");
    translateUserToGraphQLUser = module.translateUserToGraphQLUser;
  });

  afterEach(() => {
    mock.restore();
  });

  describe("PUBLIC_ALLOWED flag behavior", () => {
    test('Unit -> translateUserToGraphQLUser sets isActive to true when PUBLIC_ALLOWED is "true"', () => {
      mockENV.PUBLIC_ALLOWED = "true";
      const user = { ...defaultPrismaUser, active: false };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.name).toBe(user.name);
      expect(result.subscriptionTier).toBe(user.subscriptionTier);
    });

    test("Unit -> translateUserToGraphQLUser uses database value when PUBLIC_ALLOWED is undefined", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const activeUser = { ...defaultPrismaUser, active: true };

      const result = translateUserToGraphQLUser(activeUser);

      expect(result.isActive).toBe(true);
    });

    test('Unit -> translateUserToGraphQLUser uses database value when PUBLIC_ALLOWED is "false"', () => {
      mockENV.PUBLIC_ALLOWED = "false";
      const inactiveUser = { ...defaultPrismaUser, active: false };

      const result = translateUserToGraphQLUser(inactiveUser);

      expect(result.isActive).toBe(false);
    });

    test("Unit -> translateUserToGraphQLUser uses database value when PUBLIC_ALLOWED is empty string", () => {
      mockENV.PUBLIC_ALLOWED = "";
      const inactiveUser = { ...defaultPrismaUser, active: false };

      const result = translateUserToGraphQLUser(inactiveUser);

      expect(result.isActive).toBe(false);
    });
  });

  describe("Subscription tier logic", () => {
    test("Unit -> translateUserToGraphQLUser treats Free tier inactive users as inactive", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Free" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(false);
    });

    test("Unit -> translateUserToGraphQLUser treats Free tier active users as active", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Free" as const,
        active: true,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });

    test("Unit -> translateUserToGraphQLUser treats Tier1 users as active regardless of active flag", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Tier1" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });

    test("Unit -> translateUserToGraphQLUser treats Tier2 users as active regardless of active flag", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Tier2" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });

    test("Unit -> translateUserToGraphQLUser treats Tier3 users as active regardless of active flag", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Tier3" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });

    test("Unit -> translateUserToGraphQLUser treats Admin users as active regardless of active flag", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Admin" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });
  });

  describe("Field mapping", () => {
    test("Unit -> translateUserToGraphQLUser correctly maps all user fields", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        id: "custom-id",
        email: "custom@example.com",
        name: "Custom Name",
        subscriptionTier: "Tier1" as const,
        active: true,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.id).toBe("custom-id");
      expect(result.email).toBe("custom@example.com");
      expect(result.name).toBe("Custom Name");
      expect(result.subscriptionTier).toBe("Tier1");
      expect(result.isActive).toBe(true);
    });

    test("Unit -> translateUserToGraphQLUser handles null email and name", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        email: null,
        name: null,
        active: true,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.email).toBeNull();
      expect(result.name).toBeNull();
    });
  });

  describe("Combined scenarios", () => {
    test('Unit -> translateUserToGraphQLUser PUBLIC_ALLOWED="true" overrides subscription tier logic', () => {
      mockENV.PUBLIC_ALLOWED = "true";
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Free" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });

    test("Unit -> translateUserToGraphQLUser without PUBLIC_ALLOWED respects paid tier status", () => {
      mockENV.PUBLIC_ALLOWED = undefined;
      const user = {
        ...defaultPrismaUser,
        subscriptionTier: "Tier2" as const,
        active: false,
      };

      const result = translateUserToGraphQLUser(user);

      expect(result.isActive).toBe(true);
    });
  });
});
