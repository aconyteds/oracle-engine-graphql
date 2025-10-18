import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ServerContext } from "./serverContext";

describe("getContext", () => {
  // Declare mock variables
  let mockVerifyUser: ReturnType<typeof mock>;
  let mockCreateThreadsByCampaignIdLoader: ReturnType<typeof mock>;
  let getContext: typeof import("./serverContext").getContext;

  const defaultUser = {
    id: "user-1",
    googleAccountId: "google-123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    active: true,
    lastCampaignId: null,
  };

  const mockLoader = {
    load: mock(),
    loadMany: mock(),
    clear: mock(),
    clearAll: mock(),
    prime: mock(),
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockVerifyUser = mock();
    mockCreateThreadsByCampaignIdLoader = mock();

    // Set up module mocks INSIDE beforeEach
    mock.module("./data/Firebase", () => ({
      initializeFirebase: mock(),
      verifyUser: mockVerifyUser,
    }));

    mock.module("./modules/Thread/dataloader", () => ({
      createThreadsByCampaignIdLoader: mockCreateThreadsByCampaignIdLoader,
    }));

    // Dynamically import the module under test
    const module = await import("./serverContext");
    getContext = module.getContext;

    // Configure default mock behavior AFTER import
    mockVerifyUser.mockResolvedValue({ user: defaultUser });
    mockCreateThreadsByCampaignIdLoader.mockReturnValue(mockLoader);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> getContext extracts campaignId from HTTP headers", async () => {
    const context = await getContext({
      req: {
        headers: {
          authorization: "Bearer test-token",
          "x-selected-campaign-id": "campaign-123",
        },
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-123");
    expect(context.token).toBe("test-token");
    expect(context.user).toEqual(defaultUser);
  });

  test("Unit -> getContext extracts campaignId from WebSocket connectionParams", async () => {
    const context = await getContext({
      connectionParams: {
        authorization: "Bearer ws-token",
        "x-selected-campaign-id": "campaign-456",
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-456");
    expect(context.token).toBe("ws-token");
    expect(context.user).toEqual(defaultUser);
  });

  test("Unit -> getContext handles case-insensitive headers", async () => {
    const context = await getContext({
      req: {
        headers: {
          authorization: "Bearer test-token",
          "x-selected-campaign-id": "campaign-789",
        },
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-789");
    expect(context.token).toBe("test-token");
  });

  test("Unit -> getContext prioritizes HTTP headers over connectionParams", async () => {
    const context = await getContext({
      req: {
        headers: {
          authorization: "Bearer http-token",
          "x-selected-campaign-id": "campaign-http",
        },
      },
      connectionParams: {
        authorization: "Bearer ws-token",
        "x-selected-campaign-id": "campaign-ws",
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-http");
    expect(context.token).toBe("http-token");
  });

  test("Unit -> getContext creates fresh DataLoader instances", async () => {
    await getContext({
      req: {
        headers: {
          authorization: "Bearer test-token",
        },
      },
    });

    expect(mockCreateThreadsByCampaignIdLoader).toHaveBeenCalledTimes(1);
  });

  test("Unit -> getContext handles missing campaignId gracefully", async () => {
    const context = await getContext({
      req: {
        headers: {
          authorization: "Bearer test-token",
        },
      },
    });

    expect(context.selectedCampaignId).toBeUndefined();
    expect(context.token).toBe("test-token");
  });

  test("Unit -> getContext handles missing token gracefully", async () => {
    const context = await getContext({
      req: {
        headers: {
          "x-selected-campaign-id": "campaign-123",
        },
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-123");
    expect(context.user).toBeNull(); // No token means no user
  });

  test("Unit -> getContext handles authentication errors gracefully", async () => {
    mockVerifyUser.mockRejectedValue(new Error("Invalid token"));

    const context = await getContext({
      req: {
        headers: {
          authorization: "Bearer invalid-token",
          "x-selected-campaign-id": "campaign-123",
        },
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-123");
    expect(context.user).toBeNull(); // Auth failed, user is null
  });

  test("Unit -> getContext normalizes connectionParams keys", async () => {
    const context = await getContext({
      connectionParams: {
        Authorization: "Bearer ws-token",
        "X-SELECTED-CAMPAIGN-ID": "campaign-uppercase",
      },
    });

    expect(context.selectedCampaignId).toBe("campaign-uppercase");
    expect(context.token).toBe("ws-token");
  });

  test("Unit -> getContext includes pubsub and loaders in context", async () => {
    const context = await getContext({
      req: {
        headers: {
          authorization: "Bearer test-token",
        },
      },
    });

    expect(context.pubsub).toBeDefined();
    expect(context.loaders).toBeDefined();
    expect(context.loaders.threadsByCampaignId).toBeDefined();
  });
});
