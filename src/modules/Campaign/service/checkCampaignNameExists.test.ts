import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("checkCampaignNameExists", () => {
  let mockDBClient: {
    campaign: {
      findUnique: ReturnType<typeof mock>;
    };
  };
  let checkCampaignNameExists: typeof import("./checkCampaignNameExists").checkCampaignNameExists;

  const defaultParams = {
    ownerId: "user-123",
    name: "Test Campaign",
  };

  const mockCampaign = {
    id: "campaign-123",
    ownerId: "user-123",
    name: "Test Campaign",
    setting: "Fantasy",
    tone: "Heroic",
    ruleset: "D&D 5e",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mock.restore();

    const mockFindUnique = mock();
    mockDBClient = {
      campaign: {
        findUnique: mockFindUnique,
      },
    };

    mock.module("../../../data/MongoDB/client", () => ({
      DBClient: mockDBClient,
    }));

    const module = await import("./checkCampaignNameExists");
    checkCampaignNameExists = module.checkCampaignNameExists;

    mockDBClient.campaign.findUnique.mockResolvedValue(mockCampaign);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> checkCampaignNameExists returns true when campaign name exists", async () => {
    const result = await checkCampaignNameExists(defaultParams);

    expect(mockDBClient.campaign.findUnique).toHaveBeenCalledWith({
      where: {
        ownerId_name: {
          ownerId: defaultParams.ownerId,
          name: defaultParams.name,
        },
      },
    });
    expect(result).toBe(true);
  });

  test("Unit -> checkCampaignNameExists returns false when campaign name does not exist", async () => {
    mockDBClient.campaign.findUnique.mockResolvedValue(null);

    const result = await checkCampaignNameExists(defaultParams);

    expect(mockDBClient.campaign.findUnique).toHaveBeenCalledWith({
      where: {
        ownerId_name: {
          ownerId: defaultParams.ownerId,
          name: defaultParams.name,
        },
      },
    });
    expect(result).toBe(false);
  });
});
