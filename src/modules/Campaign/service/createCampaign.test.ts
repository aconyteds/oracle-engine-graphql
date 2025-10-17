import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign } from "../../../data/MongoDB";
import type { CreateCampaignParams } from "./createCampaign";

describe("createCampaign", () => {
  // Declare mock variables
  let mockCreate: ReturnType<typeof mock>;
  let mockCheckCampaignNameExists: ReturnType<typeof mock>;
  let mockGetLastSelectedCampaign: ReturnType<typeof mock>;
  let mockSelectCampaign: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      create: ReturnType<typeof mock>;
    };
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
    mockCreate = mock();
    mockCheckCampaignNameExists = mock();
    mockGetLastSelectedCampaign = mock();
    mockSelectCampaign = mock();
    mockDBClient = {
      campaign: {
        create: mockCreate,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("./checkCampaignNameExists", () => ({
      checkCampaignNameExists: mockCheckCampaignNameExists,
    }));

    mock.module("./getLastSelectedCampaign", () => ({
      getLastSelectedCampaign: mockGetLastSelectedCampaign,
    }));

    mock.module("./selectCampaign", () => ({
      selectCampaign: mockSelectCampaign,
    }));

    // Dynamically import the module under test
    const module = await import("./createCampaign");
    createCampaign = module.createCampaign;

    // Configure default mock behavior AFTER import
    mockCheckCampaignNameExists.mockResolvedValue(false);
    mockGetLastSelectedCampaign.mockResolvedValue(null);
    mockSelectCampaign.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(defaultCampaign);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> createCampaign creates campaign with provided data", async () => {
    const result = await createCampaign(defaultCampaignParams);

    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "My Campaign",
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        name: "My Campaign",
        setting: "Fantasy World",
        tone: "Epic",
        ruleset: "D&D 5e",
      },
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

    mockCreate.mockResolvedValue(customCampaign);

    const result = await createCampaign(customParams);

    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-2",
      name: "Dark Fantasy",
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: customParams,
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
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("Unit -> createCampaign selects campaign if user has no campaigns", async () => {
    mockGetLastSelectedCampaign.mockResolvedValue(null);

    await createCampaign(defaultCampaignParams);

    expect(mockGetLastSelectedCampaign).toHaveBeenCalledWith("user-1");
    expect(mockSelectCampaign).toHaveBeenCalledWith("campaign-1", "user-1");
  });

  test("Unit -> createCampaign does not select campaign if user already has campaigns", async () => {
    const existingCampaign: Campaign = {
      id: "existing-campaign",
      ownerId: "user-1",
      name: "Existing Campaign",
      setting: "Fantasy",
      tone: "Heroic",
      ruleset: "D&D 5e",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockGetLastSelectedCampaign.mockResolvedValue(existingCampaign);

    await createCampaign(defaultCampaignParams);

    expect(mockGetLastSelectedCampaign).toHaveBeenCalledWith("user-1");
    expect(mockSelectCampaign).not.toHaveBeenCalled();
  });
});
