import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Campaign } from "../../../data/MongoDB";
import type { UpdateCampaignParams } from "./updateCampaign";

describe("updateCampaign", () => {
  // Declare mock variables
  let mockUpdate: ReturnType<typeof mock>;
  let mockFindUnique: ReturnType<typeof mock>;
  let mockCheckCampaignNameExists: ReturnType<typeof mock>;
  let mockDBClient: {
    campaign: {
      update: ReturnType<typeof mock>;
      findUnique: ReturnType<typeof mock>;
    };
  };
  let updateCampaign: typeof import("./updateCampaign").updateCampaign;

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

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockUpdate = mock();
    mockFindUnique = mock();
    mockCheckCampaignNameExists = mock();
    mockDBClient = {
      campaign: {
        update: mockUpdate,
        findUnique: mockFindUnique,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("../../../data/MongoDB", () => ({
      DBClient: mockDBClient,
    }));

    mock.module("./checkCampaignNameExists", () => ({
      checkCampaignNameExists: mockCheckCampaignNameExists,
    }));

    // Dynamically import the module under test
    const module = await import("./updateCampaign");
    updateCampaign = module.updateCampaign;

    // Configure default mock behavior AFTER import
    mockFindUnique.mockResolvedValue(defaultCampaign);
    mockCheckCampaignNameExists.mockResolvedValue(false);
    mockUpdate.mockResolvedValue(defaultCampaign);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> updateCampaign updates single field", async () => {
    const params: UpdateCampaignParams = {
      campaignId: "campaign-1",
      name: "Updated Campaign Name",
    };

    const updatedCampaign: Campaign = {
      ...defaultCampaign,
      name: "Updated Campaign Name",
    };

    mockUpdate.mockResolvedValue(updatedCampaign);

    const result = await updateCampaign(params);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "Updated Campaign Name",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
      data: {
        name: "Updated Campaign Name",
      },
    });
    expect(result).toEqual(updatedCampaign);
  });

  test("Unit -> updateCampaign updates multiple fields", async () => {
    const params: UpdateCampaignParams = {
      campaignId: "campaign-1",
      name: "New Name",
      tone: "Dark",
      setting: "New Setting",
    };

    const updatedCampaign: Campaign = {
      ...defaultCampaign,
      name: "New Name",
      tone: "Dark",
      setting: "New Setting",
    };

    mockUpdate.mockResolvedValue(updatedCampaign);

    const result = await updateCampaign(params);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "New Name",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
      data: {
        name: "New Name",
        tone: "Dark",
        setting: "New Setting",
      },
    });
    expect(result).toEqual(updatedCampaign);
  });

  test("Unit -> updateCampaign filters out undefined values", async () => {
    const params: UpdateCampaignParams = {
      campaignId: "campaign-1",
      name: "Updated Name",
      tone: undefined,
      setting: undefined,
    };

    await updateCampaign(params);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "Updated Name",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
      data: {
        name: "Updated Name",
      },
    });
  });

  test("Unit -> updateCampaign handles all fields update", async () => {
    const params: UpdateCampaignParams = {
      campaignId: "campaign-1",
      name: "Complete Update",
      setting: "New World",
      tone: "Heroic",
      ruleset: "Pathfinder 2e",
    };

    const updatedCampaign: Campaign = {
      ...defaultCampaign,
      name: "Complete Update",
      setting: "New World",
      tone: "Heroic",
      ruleset: "Pathfinder 2e",
    };

    mockUpdate.mockResolvedValue(updatedCampaign);

    const result = await updateCampaign(params);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "Complete Update",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
      data: {
        name: "Complete Update",
        setting: "New World",
        tone: "Heroic",
        ruleset: "Pathfinder 2e",
      },
    });
    expect(result).toEqual(updatedCampaign);
  });

  test("Unit -> updateCampaign throws InvalidInput error when campaign name already exists", async () => {
    mockCheckCampaignNameExists.mockResolvedValue(true);

    const params: UpdateCampaignParams = {
      campaignId: "campaign-1",
      name: "Duplicate Name",
    };

    await expect(updateCampaign(params)).rejects.toThrow(
      'A campaign with the name "Duplicate Name" already exists'
    );

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
    });
    expect(mockCheckCampaignNameExists).toHaveBeenCalledWith({
      ownerId: "user-1",
      name: "Duplicate Name",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("Unit -> updateCampaign throws InvalidInput error when campaign not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const params: UpdateCampaignParams = {
      campaignId: "non-existent-id",
      name: "New Name",
    };

    await expect(updateCampaign(params)).rejects.toThrow("Campaign not found");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "non-existent-id" },
    });
    expect(mockCheckCampaignNameExists).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("Unit -> updateCampaign updates without name validation when name is not changed", async () => {
    const params: UpdateCampaignParams = {
      campaignId: "campaign-1",
      tone: "Dark",
      setting: "New Setting",
    };

    const updatedCampaign: Campaign = {
      ...defaultCampaign,
      tone: "Dark",
      setting: "New Setting",
    };

    mockUpdate.mockResolvedValue(updatedCampaign);

    const result = await updateCampaign(params);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCheckCampaignNameExists).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
      },
      data: {
        tone: "Dark",
        setting: "New Setting",
      },
    });
    expect(result).toEqual(updatedCampaign);
  });
});
