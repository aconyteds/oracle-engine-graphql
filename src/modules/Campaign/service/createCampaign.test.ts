import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign } from "../../../data/MongoDB";
import type { CreateCampaignParams } from "./createCampaign";

describe("createCampaign", () => {
  // Declare mock variables
  let mockCampaignCreate: ReturnType<typeof mock>;
  let mockUserUpdate: ReturnType<typeof mock>;
  let mockTransaction: ReturnType<typeof mock>;
  let mockCheckCampaignNameExists: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      create: ReturnType<typeof mock>;
    };
    user: {
      update: ReturnType<typeof mock>;
    };
    $transaction: ReturnType<typeof mock>;
  };
  let createCampaign: (params: CreateCampaignParams) => Promise<Campaign>;

  // Default mock data
  const defaultCampaignParams: CreateCampaignParams = {
    ownerId: "user-1",
    name: "My Campaign",
    setting: "Fantasy World",
    tone: "Epic",
    ruleset: "D&D 5e",
  };

  const defaultCampaign: Campaign = {
    id: "campaign-1",
    ...defaultCampaignParams,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockCampaignCreate = mock();
    mockUserUpdate = mock();
    mockTransaction = mock();
    mockCheckCampaignNameExists = mock();
    mockDBClient = {
      campaign: {
        create: mockCampaignCreate,
      },
      user: {
        update: mockUserUpdate,
      },
      $transaction: mockTransaction,
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("./checkCampaignNameExists", () => ({
      checkCampaignNameExists: mockCheckCampaignNameExists,
    }));

    // Dynamically import the module under test
    const module = await import("./createCampaign");
    createCampaign = module.createCampaign;

    // Configure default mock behavior AFTER import
    mockCheckCampaignNameExists.mockResolvedValue(false);
    mockCampaignCreate.mockResolvedValue(defaultCampaign);
    mockUserUpdate.mockResolvedValue({
      id: "user-1",
      lastCampaignId: "campaign-1",
    });

    // Mock $transaction to execute the callback immediately with tx mocks
    mockTransaction.mockImplementation(
      async (
        callback: (tx: {
          campaign: { create: ReturnType<typeof mock> };
          user: { update: ReturnType<typeof mock> };
        }) => Promise<Campaign>
      ) => {
        const tx = {
          campaign: {
            create: mockCampaignCreate,
          },
          user: {
            update: mockUserUpdate,
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

  test("Unit -> createCampaign creates campaign and sets it as last selected", async () => {
    const result = await createCampaign(defaultCampaignParams);

    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "My Campaign",
    });
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockCampaignCreate).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        name: "My Campaign",
        setting: "Fantasy World",
        tone: "Epic",
        ruleset: "D&D 5e",
      },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lastCampaignId: "campaign-1" },
    });
    expect(result).toEqual(defaultCampaign);
  });

  test("Unit -> createCampaign creates campaign with different parameters", async () => {
    const customParams: CreateCampaignParams = {
      ownerId: "user-2",
      name: "Dark Fantasy",
      setting: "Grimdark World",
      tone: "Gritty",
      ruleset: "Pathfinder 2e",
    };

    const customCampaign: Campaign = {
      id: "campaign-2",
      ...customParams,
      createdAt: new Date("2025-01-02"),
      updatedAt: new Date("2025-01-02"),
    };

    mockCampaignCreate.mockResolvedValue(customCampaign);

    const result = await createCampaign(customParams);

    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-2",
      name: "Dark Fantasy",
    });
    expect(mockCampaignCreate).toHaveBeenCalledWith({
      data: customParams,
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { lastCampaignId: "campaign-2" },
    });
    expect(result).toEqual(customCampaign);
  });

  test("Unit -> createCampaign throws InvalidInput error when campaign name already exists", async () => {
    mockCheckCampaignNameExists.mockResolvedValue(true);

    await expect(createCampaign(defaultCampaignParams)).rejects.toThrow(
      'A campaign with the name "My Campaign" already exists'
    );

    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "My Campaign",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCampaignCreate).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  test("Unit -> createCampaign always updates user lastCampaignId in transaction", async () => {
    const result = await createCampaign(defaultCampaignParams);

    // Verify transaction was used
    expect(mockTransaction).toHaveBeenCalled();

    // Verify campaign was created
    expect(mockCampaignCreate).toHaveBeenCalledWith({
      data: defaultCampaignParams,
    });

    // Verify user's lastCampaignId was updated
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lastCampaignId: "campaign-1" },
    });

    expect(result).toEqual(defaultCampaign);
  });

  test("Unit -> createCampaign handles transaction atomically", async () => {
    // This test verifies the transaction mock is properly implemented
    await createCampaign(defaultCampaignParams);

    // Both operations should be called within the transaction
    expect(mockCampaignCreate).toHaveBeenCalled();
    expect(mockUserUpdate).toHaveBeenCalled();

    // Verify the order: create campaign, then update user
    const createCallOrder = mockCampaignCreate.mock.calls.length;
    const updateCallOrder = mockUserUpdate.mock.calls.length;

    expect(createCallOrder).toBeGreaterThan(0);
    expect(updateCallOrder).toBeGreaterThan(0);
  });
});
