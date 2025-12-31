import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";

describe("updatePlot", () => {
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockUpdateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let updatePlot: typeof import("./updatePlot").updatePlot;

  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultPlotId = "plot-001";

  const defaultExistingAsset: CampaignAsset = {
    id: defaultPlotId,
    campaignId: defaultCampaignId,
    name: "The Missing Merchant Prince",
    recordType: RecordType.Plot,
    summary: "Original summary",
    playerSummary: "Original player summary",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    plotData: {
      dmNotes: "Original DM notes",
      sharedWithPlayers: "Original shared",
      status: PlotStatus.InProgress,
      urgency: Urgency.TimeSensitive,
    },
    npcData: null,
    locationData: null,
    sessionEventLink: [],
  };

  beforeEach(async () => {
    mock.restore();

    mockVerifyCampaignAssetOwnership = mock();
    mockGetCampaignAssetById = mock();
    mockUpdateCampaignAsset = mock();
    mockStringifyCampaignAsset = mock();

    mock.module(
      "../../../../MongoDB/campaignAsset/verifyCampaignAssetOwnership",
      () => ({
        verifyCampaignAssetOwnership: mockVerifyCampaignAssetOwnership,
      })
    );

    mock.module("../../../../MongoDB/campaignAsset/getById", () => ({
      getCampaignAssetById: mockGetCampaignAssetById,
    }));

    mock.module("../../../../MongoDB/campaignAsset/update", () => ({
      updateCampaignAsset: mockUpdateCampaignAsset,
    }));

    mock.module("../../../../MongoDB/campaignAsset/embedCampaignAsset", () => ({
      embedCampaignAsset: mock(),
      stringifyCampaignAsset: mockStringifyCampaignAsset,
    }));

    mock.module("../../createEmbeddings", () => ({
      createEmbeddings: mock(),
    }));

    mock.module("../../../Agents/plotAgent", () => ({
      plotAgent: {
        name: "plot_agent",
        availableTools: [],
      },
    }));

    const module = await import("./updatePlot");
    updatePlot = module.updatePlot;

    mockVerifyCampaignAssetOwnership.mockResolvedValue(undefined);
    mockGetCampaignAssetById.mockResolvedValue(defaultExistingAsset);
    mockUpdateCampaignAsset.mockResolvedValue(defaultExistingAsset);
    mockStringifyCampaignAsset.mockResolvedValue("Updated plot details");
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> updatePlot updates plot successfully", async () => {
    const result = await updatePlot(
      {
        plotId: defaultPlotId,
        name: "Updated Name",
        plotData: {
          status: PlotStatus.Closed,
        },
      },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: "thread-123",
          runId: "run-abc",
        },
      }
    );

    expect(mockVerifyCampaignAssetOwnership).toHaveBeenCalledWith(
      defaultPlotId,
      defaultUserId
    );
    expect(mockGetCampaignAssetById).toHaveBeenCalledWith({
      assetId: defaultPlotId,
      recordType: RecordType.Plot,
    });
    expect(mockUpdateCampaignAsset).toHaveBeenCalled();
    expect(result).toContain("<success>");
    expect(result).toContain("Plot updated successfully");
  });

  test("Unit -> updatePlot returns error when not found", async () => {
    mockGetCampaignAssetById.mockResolvedValue(null);

    const result = await updatePlot(
      { plotId: "non-existent", name: "Test" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: "thread-123",
          runId: "run-abc",
        },
      }
    );

    expect(result).toContain("<error>");
    expect(result).toContain("not found or is not a Plot");
  });

  test("Unit -> updatePlot returns error when unauthorized", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    mockVerifyCampaignAssetOwnership.mockRejectedValue(
      new Error("User not authorized to access this asset")
    );

    try {
      const result = await updatePlot(
        { plotId: defaultPlotId, name: "Test" },
        {
          context: {
            userId: "wrong-user",
            campaignId: defaultCampaignId,
            threadId: "thread-123",
            runId: "run-abc",
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("not authorized");
    } finally {
      console.error = originalConsoleError;
    }
  });
});
