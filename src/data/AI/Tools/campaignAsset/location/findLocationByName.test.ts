import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("findLocationByName", () => {
  // Declare mock variables
  let mockFindCampaignAssetByName: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let findLocationByName: typeof import("./findLocationByName").findLocationByName;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";

  const defaultLocationAsset: CampaignAsset = {
    id: "asset-location-1",
    campaignId: defaultCampaignId,
    name: "The Rusty Dragon Inn",
    recordType: RecordType.Location,
    summary: "A popular tavern in town",
    playerSummary: "A cozy inn",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    locationData: {
      imageUrl: "https://example.com/inn.jpg",
      description: "A warm, inviting tavern",
      condition: "Well-maintained",
      pointsOfInterest: "Bar, rooms upstairs",
      characters: "Innkeeper, patrons",
      dmNotes: "Secret passage in cellar",
      sharedWithPlayers: "The inn is popular with adventurers",
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultStringifiedAsset =
    "Name: The Rusty Dragon Inn\nSummary: A popular tavern in town";

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockFindCampaignAssetByName = mock();
    mockStringifyCampaignAsset = mock();

    // Set up module mocks - mock specific submodules instead of barrel exports
    mock.module("../../../../MongoDB/campaignAsset/findByName", () => ({
      findCampaignAssetByName: mockFindCampaignAssetByName,
    }));

    mock.module("../../../../MongoDB/campaignAsset/embedCampaignAsset", () => ({
      embedCampaignAsset: mock(), // Export all from the module even if unused
      stringifyCampaignAsset: mockStringifyCampaignAsset,
    }));

    // Mock createEmbeddings to prevent circular dependency via agentList
    mock.module("../../createEmbeddings", () => ({
      createEmbeddings: mock(),
    }));

    // Mock the locationAgent to break circular dependency
    mock.module("../../../Agents/locationAgent", () => ({
      locationAgent: {
        name: "location_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./findLocationByName");
    findLocationByName = module.findLocationByName;

    // Configure default behavior
    mockFindCampaignAssetByName.mockResolvedValue(defaultLocationAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> findLocationByName finds location by exact name", async () => {
    const result = await findLocationByName(
      { name: "The Rusty Dragon Inn" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(mockFindCampaignAssetByName).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      name: "The Rusty Dragon Inn",
      recordType: RecordType.Location,
    });
    expect(mockStringifyCampaignAsset).toHaveBeenCalledWith(
      defaultLocationAsset
    );
    expect(result).toContain("<location");
    expect(result).toContain('id="asset-location-1"');
    expect(result).toContain('name="The Rusty Dragon Inn"');
    expect(result).toContain(defaultStringifiedAsset);
  });

  test("Unit -> findLocationByName returns not found message when asset doesn't exist", async () => {
    mockFindCampaignAssetByName.mockResolvedValue(null);

    const result = await findLocationByName(
      { name: "Nonexistent Location" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toContain("<result>");
    expect(result).toContain("No location found with exact name");
    expect(result).toContain("Nonexistent Location");
    expect(result).toContain("find_campaign_asset");
    expect(mockStringifyCampaignAsset).not.toHaveBeenCalled();
  });

  test("Unit -> findLocationByName handles errors with console.error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database connection failed");
    mockFindCampaignAssetByName.mockRejectedValue(testError);

    try {
      const result = await findLocationByName(
        { name: "The Rusty Dragon Inn" },
        {
          context: {
            userId: defaultUserId,
            campaignId: defaultCampaignId,
            threadId: defaultThreadId,
            runId: defaultRunId,
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain(
        "An error occurred while searching for the location by name"
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in findLocationByName tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> findLocationByName validates input schema", async () => {
    await expect(
      findLocationByName({ name: 123 } as any, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> findLocationByName returns XML formatted response", async () => {
    const result = await findLocationByName(
      { name: "The Rusty Dragon Inn" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toMatch(/<location id="[^"]+"/);
    expect(result).toContain("</location>");
  });
});
