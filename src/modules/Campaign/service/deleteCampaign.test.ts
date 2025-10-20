import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign, User } from "../../../data/MongoDB";
import type { DeleteCampaignParams } from "./deleteCampaign";

describe("deleteCampaign", () => {
  // Declare mock variables
  let mockCampaignDelete: ReturnType<typeof mock>;
  let mockCampaignFindUnique: ReturnType<typeof mock>;
  let mockUserFindUnique: ReturnType<typeof mock>;
  let mockUserUpdate: ReturnType<typeof mock>;
  let mockThreadFindMany: ReturnType<typeof mock>;
  let mockThreadDeleteMany: ReturnType<typeof mock>;
  let mockMessageDeleteMany: ReturnType<typeof mock>;
  let mockSessionEventDeleteMany: ReturnType<typeof mock>;
  let mockCampaignAssetDeleteMany: ReturnType<typeof mock>;
  let mockTransaction: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      delete: ReturnType<typeof mock>;
      findUnique: ReturnType<typeof mock>;
    };
    user: {
      findUnique: ReturnType<typeof mock>;
      update: ReturnType<typeof mock>;
    };
    thread: {
      findMany: ReturnType<typeof mock>;
      deleteMany: ReturnType<typeof mock>;
    };
    message: {
      deleteMany: ReturnType<typeof mock>;
    };
    sessionEvent: {
      deleteMany: ReturnType<typeof mock>;
    };
    campaignAsset: {
      deleteMany: ReturnType<typeof mock>;
    };
    $transaction: ReturnType<typeof mock>;
  };
  let deleteCampaign: typeof import("./deleteCampaign").deleteCampaign;

  // Default mock data
  const defaultCampaign: Campaign = {
    id: "campaign-1",
    ownerId: "user-1",
    name: "My Campaign",
    setting: "Fantasy World",
    tone: "Epic",
    ruleset: "D&D 5e",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
  };

  const defaultUser: User = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    googleAccountId: "google-123",
    lastCampaignId: null,
    active: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCampaignDelete = mock();
    mockCampaignFindUnique = mock();
    mockUserFindUnique = mock();
    mockUserUpdate = mock();
    mockThreadFindMany = mock();
    mockThreadDeleteMany = mock();
    mockMessageDeleteMany = mock();
    mockSessionEventDeleteMany = mock();
    mockCampaignAssetDeleteMany = mock();
    mockTransaction = mock();
    mockDBClient = {
      campaign: {
        delete: mockCampaignDelete,
        findUnique: mockCampaignFindUnique,
      },
      user: {
        findUnique: mockUserFindUnique,
        update: mockUserUpdate,
      },
      thread: {
        findMany: mockThreadFindMany,
        deleteMany: mockThreadDeleteMany,
      },
      message: {
        deleteMany: mockMessageDeleteMany,
      },
      sessionEvent: {
        deleteMany: mockSessionEventDeleteMany,
      },
      campaignAsset: {
        deleteMany: mockCampaignAssetDeleteMany,
      },
      $transaction: mockTransaction,
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./deleteCampaign");
    deleteCampaign = module.deleteCampaign;

    // Configure default mock behavior AFTER import
    mockCampaignFindUnique.mockResolvedValue(defaultCampaign);
    mockUserFindUnique.mockResolvedValue(defaultUser);
    mockUserUpdate.mockResolvedValue({ ...defaultUser, lastCampaignId: null });
    mockCampaignDelete.mockResolvedValue(defaultCampaign);
    mockThreadFindMany.mockResolvedValue([]);
    mockThreadDeleteMany.mockResolvedValue({ count: 0 });
    mockMessageDeleteMany.mockResolvedValue({ count: 0 });
    mockSessionEventDeleteMany.mockResolvedValue({ count: 0 });
    mockCampaignAssetDeleteMany.mockResolvedValue({ count: 0 });

    // Mock $transaction to execute the callback immediately with tx mocks
    mockTransaction.mockImplementation(
      async (
        callback: (tx: {
          campaign: { delete: ReturnType<typeof mock> };
          user: { update: ReturnType<typeof mock> };
          thread: {
            findMany: ReturnType<typeof mock>;
            deleteMany: ReturnType<typeof mock>;
          };
          message: { deleteMany: ReturnType<typeof mock> };
          sessionEvent: { deleteMany: ReturnType<typeof mock> };
          campaignAsset: { deleteMany: ReturnType<typeof mock> };
        }) => Promise<void>
      ) => {
        const tx = {
          campaign: {
            delete: mockCampaignDelete,
          },
          user: {
            update: mockUserUpdate,
          },
          thread: {
            findMany: mockThreadFindMany,
            deleteMany: mockThreadDeleteMany,
          },
          message: {
            deleteMany: mockMessageDeleteMany,
          },
          sessionEvent: {
            deleteMany: mockSessionEventDeleteMany,
          },
          campaignAsset: {
            deleteMany: mockCampaignAssetDeleteMany,
          },
        };
        return await callback(tx);
      }
    );
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> deleteCampaign deletes campaign successfully", async () => {
    const params: DeleteCampaignParams = {
      campaignId: "campaign-1",
      ownerId: "user-1",
    };

    const result = await deleteCampaign(params);

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(mockCampaignDelete).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(result).toEqual({
      success: true,
      campaignId: "campaign-1",
    });
  });

  test("Unit -> deleteCampaign throws InvalidInput error when campaign not found", async () => {
    mockCampaignFindUnique.mockResolvedValue(null);

    const params: DeleteCampaignParams = {
      campaignId: "non-existent-id",
      ownerId: "user-1",
    };

    await expect(deleteCampaign(params)).rejects.toThrow("Campaign not found");

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "non-existent-id" },
    });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockCampaignDelete).not.toHaveBeenCalled();
  });

  test("Unit -> deleteCampaign throws InvalidInput error when user does not own campaign", async () => {
    const params: DeleteCampaignParams = {
      campaignId: "campaign-1",
      ownerId: "different-user",
    };

    await expect(deleteCampaign(params)).rejects.toThrow(
      "You do not have permission to delete this campaign"
    );

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockCampaignDelete).not.toHaveBeenCalled();
  });

  test("Unit -> deleteCampaign verifies ownership before deletion", async () => {
    const userOwnedCampaign: Campaign = {
      ...defaultCampaign,
      id: "campaign-2",
      ownerId: "user-2",
    };

    const user2: User = {
      ...defaultUser,
      id: "user-2",
      lastCampaignId: null,
    };

    mockCampaignFindUnique.mockResolvedValue(userOwnedCampaign);
    mockUserFindUnique.mockResolvedValue(user2);

    const params: DeleteCampaignParams = {
      campaignId: "campaign-2",
      ownerId: "user-2",
    };

    const result = await deleteCampaign(params);

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-2" },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-2" },
    });
    expect(mockCampaignDelete).toHaveBeenCalledWith({
      where: { id: "campaign-2" },
    });
    expect(result).toEqual({
      success: true,
      campaignId: "campaign-2",
    });
  });

  test("Unit -> deleteCampaign clears user lastCampaignId when it matches deleted campaign", async () => {
    const userWithSelectedCampaign: User = {
      ...defaultUser,
      lastCampaignId: "campaign-1",
    };

    mockUserFindUnique.mockResolvedValue(userWithSelectedCampaign);

    const params: DeleteCampaignParams = {
      campaignId: "campaign-1",
      ownerId: "user-1",
    };

    const result = await deleteCampaign(params);

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lastCampaignId: null },
    });
    expect(mockCampaignDelete).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(result).toEqual({
      success: true,
      campaignId: "campaign-1",
    });
  });

  test("Unit -> deleteCampaign does not update user when lastCampaignId does not match", async () => {
    const userWithDifferentCampaign: User = {
      ...defaultUser,
      lastCampaignId: "campaign-2",
    };

    mockUserFindUnique.mockResolvedValue(userWithDifferentCampaign);

    const params: DeleteCampaignParams = {
      campaignId: "campaign-1",
      ownerId: "user-1",
    };

    const result = await deleteCampaign(params);

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockCampaignDelete).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(result).toEqual({
      success: true,
      campaignId: "campaign-1",
    });
  });

  test("Unit -> deleteCampaign does not update user when lastCampaignId is null", async () => {
    const params: DeleteCampaignParams = {
      campaignId: "campaign-1",
      ownerId: "user-1",
    };

    const result = await deleteCampaign(params);

    expect(mockCampaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockCampaignDelete).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(result).toEqual({
      success: true,
      campaignId: "campaign-1",
    });
  });
});
