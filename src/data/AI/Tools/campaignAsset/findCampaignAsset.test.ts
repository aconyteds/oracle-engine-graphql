import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("findCampaignAsset", () => {
  // Declare mock variables with 'let'
  let mockSearchCampaignAssets: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let findCampaignAsset: typeof import("./findCampaignAsset").findCampaignAsset;

  // Default mock data
  const defaultContext = {
    campaignId: "campaign-123",
    userId: "user-456",
  };

  const defaultAssetResult = {
    id: "asset-1",
    campaignId: "campaign-123",
    recordType: "NPC" as const,
    name: "Gandalf",
    summary: "A wise wizard",
    playerSummary: "A mysterious wizard",
    sessionEventLink: [],
    locationData: null,
    plotData: null,
    npcData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    score: 0.85,
  };

  const defaultSearchResult = {
    assets: [defaultAssetResult],
    timings: {
      embeddingDuration: 100,
      searchDuration: 50,
      totalDuration: 150,
    },
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockSearchCampaignAssets = mock();
    mockStringifyCampaignAsset = mock();

    // Set up module mocks - mock the barrel export
    mock.module("../../../MongoDB", () => ({
      searchCampaignAssets: mockSearchCampaignAssets,
      stringifyCampaignAsset: mockStringifyCampaignAsset,
    }));

    // Mock agents that use this tool to break circular dependencies
    mock.module("../../Agents/cheapest", () => ({
      cheapest: {
        name: "cheapest",
        availableTools: [],
      },
    }));

    mock.module("../../Agents/locationAgent", () => ({
      locationAgent: {
        name: "location_agent",
        availableTools: [],
      },
    }));

    mock.module("../../Agents/defaultRouter", () => ({
      defaultRouter: {
        name: "default_router",
        availableTools: [],
      },
    }));

    // Dynamically import the module under test
    const module = await import("./findCampaignAsset");
    findCampaignAsset = module.findCampaignAsset;

    // Configure default mock behavior
    mockSearchCampaignAssets.mockResolvedValue(defaultSearchResult);
    mockStringifyCampaignAsset.mockResolvedValue(
      "Name: Gandalf\nSummary: A wise wizard"
    );
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> findCampaignAsset returns formatted results for matching assets", async () => {
    const result = await findCampaignAsset.invoke(
      {
        query: "wise wizard",
      },
      {
        context: defaultContext,
      }
    );

    expect(mockSearchCampaignAssets).toHaveBeenCalledWith({
      campaignId: "campaign-123",
      query: "wise wizard",
      keywords: undefined,
      limit: 10,
      minScore: 0.6,
      recordType: undefined,
    });

    expect(mockStringifyCampaignAsset).toHaveBeenCalledWith(defaultAssetResult);

    expect(result).toBe(
      '<asset id="asset-1" type="NPC">Name: Gandalf\nSummary: A wise wizard</asset>'
    );
  });

  test("Unit -> findCampaignAsset filters by recordType when provided", async () => {
    await findCampaignAsset.invoke(
      {
        query: "ancient tower",
        recordType: "Location",
      },
      {
        context: defaultContext,
      }
    );

    expect(mockSearchCampaignAssets).toHaveBeenCalledWith({
      campaignId: "campaign-123",
      query: "ancient tower",
      keywords: undefined,
      limit: 10,
      minScore: 0.6,
      recordType: "Location",
    });
  });

  test("Unit -> findCampaignAsset handles multiple assets in results", async () => {
    const asset2 = {
      ...defaultAssetResult,
      id: "asset-2",
      recordType: "Location" as const,
      name: "Rivendell",
      summary: "An elven refuge",
      score: 0.75,
    };

    mockSearchCampaignAssets.mockResolvedValue({
      assets: [{ ...defaultAssetResult, score: 0.9 }, asset2],
      timings: defaultSearchResult.timings,
    });

    mockStringifyCampaignAsset
      .mockResolvedValueOnce("Name: Gandalf\nSummary: A wise wizard")
      .mockResolvedValueOnce("Name: Rivendell\nSummary: An elven refuge");

    const result = await findCampaignAsset.invoke(
      {
        query: "elven wizard",
      },
      {
        context: defaultContext,
      }
    );

    expect(mockStringifyCampaignAsset).toHaveBeenCalledTimes(2);
    expect(result).toBe(
      '<asset id="asset-1" type="NPC">Name: Gandalf\nSummary: A wise wizard</asset>' +
        '<asset id="asset-2" type="Location">Name: Rivendell\nSummary: An elven refuge</asset>'
    );
  });

  test("Unit -> findCampaignAsset returns message when no assets found", async () => {
    mockSearchCampaignAssets.mockResolvedValue({
      assets: [],
    });

    const result = await findCampaignAsset.invoke(
      {
        query: "nonexistent character",
      },
      {
        context: defaultContext,
      }
    );

    expect(result).toBe("No relevant campaign assets found.");
    expect(mockStringifyCampaignAsset).not.toHaveBeenCalled();
  });

  test("Unit -> findCampaignAsset handles search errors gracefully", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database connection failed");
    mockSearchCampaignAssets.mockRejectedValue(testError);

    try {
      const result = await findCampaignAsset.invoke(
        {
          query: "any query",
        },
        {
          context: defaultContext,
        }
      );

      expect(result).toBe(
        "An error occurred while searching for campaign assets."
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in findCampaignAsset tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> findCampaignAsset handles stringification errors gracefully", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Stringification failed");
    mockStringifyCampaignAsset.mockRejectedValue(testError);

    try {
      const result = await findCampaignAsset.invoke(
        {
          query: "wise wizard",
        },
        {
          context: defaultContext,
        }
      );

      expect(result).toBe(
        "An error occurred while searching for campaign assets."
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in findCampaignAsset tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> findCampaignAsset validates input schema", async () => {
    // Test that Zod schema validation works by passing invalid recordType
    await expect(
      findCampaignAsset.invoke(
        {
          query: "test",
          recordType: "InvalidType" as never,
        },
        {
          context: defaultContext,
        }
      )
    ).rejects.toThrow();
  });

  test("Unit -> findCampaignAsset has correct tool metadata", () => {
    expect(findCampaignAsset.name).toBe("find_campaign_asset");
    expect(findCampaignAsset.description).toContain("Searches campaign assets");
    expect(findCampaignAsset.schema).toBeDefined();
  });

  test("Unit -> findCampaignAsset uses correct search parameters", async () => {
    await findCampaignAsset.invoke(
      {
        query: "test query",
      },
      {
        context: defaultContext,
      }
    );

    const callArgs = mockSearchCampaignAssets.mock.calls[0][0];
    expect(callArgs.limit).toBe(10);
    expect(callArgs.minScore).toBe(0.6);
  });

  test("Unit -> findCampaignAsset handles all valid recordTypes", async () => {
    const validTypes = ["NPC", "Location", "Plot"] as const;

    for (const recordType of validTypes) {
      await findCampaignAsset.invoke(
        {
          query: "test",
          recordType,
        },
        {
          context: defaultContext,
        }
      );

      expect(mockSearchCampaignAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          recordType,
        })
      );
    }
  });

  test("Unit -> findCampaignAsset supports keywords-only search", async () => {
    await findCampaignAsset.invoke(
      {
        keywords: "Gandalf",
      },
      {
        context: defaultContext,
      }
    );

    expect(mockSearchCampaignAssets).toHaveBeenCalledWith({
      campaignId: "campaign-123",
      query: undefined,
      keywords: "Gandalf",
      limit: 10,
      minScore: 0.6,
      recordType: undefined,
    });
  });

  test("Unit -> findCampaignAsset supports hybrid search with both query and keywords", async () => {
    await findCampaignAsset.invoke(
      {
        query: "wise wizard",
        keywords: "Gandalf",
      },
      {
        context: defaultContext,
      }
    );

    expect(mockSearchCampaignAssets).toHaveBeenCalledWith({
      campaignId: "campaign-123",
      query: "wise wizard",
      keywords: "Gandalf",
      limit: 10,
      minScore: 0.6,
      recordType: undefined,
    });
  });

  test("Unit -> findCampaignAsset requires at least query or keywords", async () => {
    await expect(
      findCampaignAsset.invoke(
        {
          recordType: "NPC",
        },
        {
          context: defaultContext,
        }
      )
    ).rejects.toThrow();
  });

  test("Unit -> findCampaignAsset description includes search strategy guidance", () => {
    expect(findCampaignAsset.description).toContain("SEARCH STRATEGIES");
    expect(findCampaignAsset.description).toContain("Semantic");
    expect(findCampaignAsset.description).toContain("keywords");
    expect(findCampaignAsset.description).toContain("Hybrid");
  });
});
