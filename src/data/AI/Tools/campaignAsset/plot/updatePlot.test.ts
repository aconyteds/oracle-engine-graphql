import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";
import { RequestContext } from "../../../types";

describe("updatePlot", () => {
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockUpdateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let updatePlot: typeof import("./updatePlot").updatePlot;

  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";
  const defaultPlotId = "plot-001";
  let defaultContext: RequestContext = {
    userId: defaultUserId,
    campaignId: defaultCampaignId,
    threadId: defaultThreadId,
    runId: defaultRunId,
    yieldMessage: () => {},
  };

  const defaultExistingAsset: CampaignAsset = {
    id: defaultPlotId,
    campaignId: defaultCampaignId,
    name: "The Missing Merchant Prince",
    recordType: RecordType.Plot,
    gmSummary: "Original summary",
    playerSummary: "Original player summary",
    gmNotes: "Original GM notes",
    playerNotes: "Original shared",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    plotData: {
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
    defaultContext = {
      userId: defaultUserId,
      campaignId: defaultCampaignId,
      threadId: defaultThreadId,
      runId: defaultRunId,
      yieldMessage: () => {},
    };
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
        context: defaultContext,
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
        context: defaultContext,
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
            ...defaultContext,
            userId: "wrong-user",
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
