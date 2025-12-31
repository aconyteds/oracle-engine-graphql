import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";

describe("findPlotByName", () => {
  // Declare mock variables
  let mockFindCampaignAssetByName: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let findPlotByName: typeof import("./findPlotByName").findPlotByName;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";

  const defaultFoundAsset: CampaignAsset = {
    id: "plot-001",
    campaignId: defaultCampaignId,
    name: "The Missing Merchant Prince",
    recordType: RecordType.Plot,
    summary: "Wealthy heir vanished from locked tower",
    playerSummary: "Lord Castellan hires you to find his missing son",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    plotData: {
      dmNotes: "Secret kidnapping by Marcus the Jester",
      sharedWithPlayers: "Vanished from locked tower",
      status: PlotStatus.InProgress,
      urgency: Urgency.TimeSensitive,
    },
    npcData: null,
    locationData: null,
    sessionEventLink: [],
  };

  const defaultStringifiedAsset =
    "Name: The Missing Merchant Prince\nDetails...";

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockFindCampaignAssetByName = mock();
    mockStringifyCampaignAsset = mock();

    // Mock specific submodules
    mock.module("../../../../MongoDB/campaignAsset/findByName", () => ({
      findCampaignAssetByName: mockFindCampaignAssetByName,
    }));

    mock.module("../../../../MongoDB/campaignAsset/embedCampaignAsset", () => ({
      embedCampaignAsset: mock(),
      stringifyCampaignAsset: mockStringifyCampaignAsset,
    }));

    // Mock circular dependencies
    mock.module("../../createEmbeddings", () => ({
      createEmbeddings: mock(),
    }));

    mock.module("../../../Agents/plotAgent", () => ({
      plotAgent: {
        name: "plot_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./findPlotByName");
    findPlotByName = module.findPlotByName;

    // Configure default behavior
    mockFindCampaignAssetByName.mockResolvedValue(defaultFoundAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> findPlotByName finds plot by exact name", async () => {
    const result = await findPlotByName(
      { name: "The Missing Merchant Prince" },
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
      name: "The Missing Merchant Prince",
      recordType: RecordType.Plot,
    });

    expect(result).toContain("<plot");
    expect(result).toContain('id="plot-001"');
    expect(result).toContain('name="The Missing Merchant Prince"');
    expect(result).toContain(defaultStringifiedAsset);
  });

  test("Unit -> findPlotByName returns helpful message when not found", async () => {
    mockFindCampaignAssetByName.mockResolvedValue(null);

    const result = await findPlotByName(
      { name: "Unknown Plot" },
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
    expect(result).toContain("No plot found");
    expect(result).toContain("Unknown Plot");
    expect(result).toContain("find_campaign_asset");
    expect(result).toContain("semantic search");
  });

  test("Unit -> findPlotByName handles errors with console.error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database query failed");
    mockFindCampaignAssetByName.mockRejectedValue(testError);

    try {
      const result = await findPlotByName(
        { name: "Test Plot" },
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
      expect(result).toContain("error occurred while searching");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in findPlotByName tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> findPlotByName returns XML formatted response", async () => {
    const result = await findPlotByName(
      { name: "The Missing Merchant Prince" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toMatch(/<plot id="[^"]+" name="[^"]+">.*<\/plot>/s);
  });

  test("Unit -> findPlotByName filters by Plot recordType", async () => {
    await findPlotByName(
      { name: "The Missing Merchant Prince" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    const callArgs = mockFindCampaignAssetByName.mock.calls[0][0];
    expect(callArgs.recordType).toBe(RecordType.Plot);
  });
});
