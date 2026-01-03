import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";
import { RequestContext } from "../../../types";

describe("deletePlot", () => {
  // Declare mock variables
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockDeleteCampaignAsset: ReturnType<typeof mock>;
  let deletePlot: typeof import("./deletePlot").deletePlot;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";
  const defaultContext: RequestContext = {
    userId: defaultUserId,
    campaignId: defaultCampaignId,
    threadId: defaultThreadId,
    runId: defaultRunId,
    yieldMessage: () => {},
  };
  const defaultPlotId = "plot-001";

  const defaultExistingAsset: CampaignAsset = {
    id: defaultPlotId,
    campaignId: defaultCampaignId,
    name: "The Missing Merchant Prince",
    recordType: RecordType.Plot,
    gmSummary: "Wealthy heir vanished from locked tower",
    playerSummary: "Lord Castellan hires you to find his missing son",
    gmNotes: "Secret kidnapping by Marcus the Jester",
    playerNotes: "Vanished from locked tower",
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

    // Create fresh mocks
    mockVerifyCampaignAssetOwnership = mock();
    mockGetCampaignAssetById = mock();
    mockDeleteCampaignAsset = mock();

    // Mock specific submodules
    mock.module(
      "../../../../MongoDB/campaignAsset/verifyCampaignAssetOwnership",
      () => ({
        verifyCampaignAssetOwnership: mockVerifyCampaignAssetOwnership,
      })
    );

    mock.module("../../../../MongoDB/campaignAsset/getById", () => ({
      getCampaignAssetById: mockGetCampaignAssetById,
    }));

    mock.module("../../../../MongoDB/campaignAsset/delete", () => ({
      deleteCampaignAsset: mockDeleteCampaignAsset,
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
    const module = await import("./deletePlot");
    deletePlot = module.deletePlot;

    // Configure default behavior
    mockVerifyCampaignAssetOwnership.mockResolvedValue(undefined);
    mockGetCampaignAssetById.mockResolvedValue(defaultExistingAsset);
    mockDeleteCampaignAsset.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> deletePlot deletes plot successfully", async () => {
    const result = await deletePlot(
      { plotId: defaultPlotId },
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
    expect(mockDeleteCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultPlotId,
    });

    expect(result).toContain("<success>");
    expect(result).toContain("The Missing Merchant Prince");
    expect(result).toContain("permanently deleted");
  });

  test("Unit -> deletePlot verifies ownership before deletion", async () => {
    await deletePlot(
      { plotId: defaultPlotId },
      {
        context: defaultContext,
      }
    );

    expect(mockVerifyCampaignAssetOwnership).toHaveBeenCalledWith(
      defaultPlotId,
      defaultUserId
    );
    expect(mockDeleteCampaignAsset).toHaveBeenCalled();
  });

  test("Unit -> deletePlot returns error when plot not found", async () => {
    mockGetCampaignAssetById.mockResolvedValue(null);

    const result = await deletePlot(
      { plotId: "non-existent-id" },
      {
        context: defaultContext,
      }
    );

    expect(result).toContain("<error>");
    expect(result).toContain("not found or is not a Plot");
    expect(mockDeleteCampaignAsset).not.toHaveBeenCalled();
  });

  test("Unit -> deletePlot returns error when user not authorized", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const authError = new Error("User not authorized to access this asset");
    mockVerifyCampaignAssetOwnership.mockRejectedValue(authError);

    try {
      const result = await deletePlot(
        { plotId: defaultPlotId },
        {
          context: {
            ...defaultContext,
            userId: "wrong-user",
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("not authorized");
      expect(mockDeleteCampaignAsset).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> deletePlot handles deletion failure", async () => {
    mockDeleteCampaignAsset.mockResolvedValue({ success: false });

    const result = await deletePlot(
      { plotId: defaultPlotId },
      {
        context: defaultContext,
      }
    );

    expect(result).toContain("<error>");
    expect(result).toContain("Failed to delete plot");
  });

  test("Unit -> deletePlot handles generic errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const genericError = new Error("Database connection failed");
    mockDeleteCampaignAsset.mockRejectedValue(genericError);

    try {
      const result = await deletePlot(
        { plotId: defaultPlotId },
        {
          context: defaultContext,
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("Failed to delete plot");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in deletePlot tool:",
        genericError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> deletePlot returns success message with plot name and ID", async () => {
    const result = await deletePlot(
      { plotId: defaultPlotId },
      {
        context: defaultContext,
      }
    );

    expect(result).toContain(`"${defaultExistingAsset.name}"`);
    expect(result).toContain(`ID: ${defaultPlotId}`);
    expect(result).toMatch(/<success>.*<\/success>/s);
  });
});
