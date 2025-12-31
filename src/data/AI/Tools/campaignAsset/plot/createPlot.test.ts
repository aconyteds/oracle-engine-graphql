import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";

describe("createPlot", () => {
  let mockCreateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let createPlot: typeof import("./createPlot").createPlot;

  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";

  const defaultPlotInput = {
    name: "The Missing Merchant Prince",
    gmSummary: "Wealthy heir vanished from locked tower",
    playerSummary: "Lord Castellan hires you to find his missing son",
    gmNotes:
      "Secret kidnapping by Marcus the Jester. Stakes: If not found in 3 days, war erupts.",
    playerNotes:
      "Vanished from locked tower three nights ago. 1000 gold reward.",
    status: PlotStatus.InProgress,
    urgency: Urgency.TimeSensitive,
  };

  const defaultCreatedAsset: CampaignAsset = {
    id: "plot-001",
    campaignId: defaultCampaignId,
    name: defaultPlotInput.name,
    recordType: RecordType.Plot,
    gmSummary: defaultPlotInput.gmSummary!,
    playerSummary: defaultPlotInput.playerSummary!,
    gmNotes: defaultPlotInput.gmNotes,
    playerNotes: defaultPlotInput.playerNotes,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    plotData: {
      status: defaultPlotInput.status,
      urgency: defaultPlotInput.urgency,
    },
    npcData: null,
    locationData: null,
    sessionEventLink: [],
  };

  const defaultStringifiedAsset =
    "Name: The Missing Merchant Prince\nDetails...";

  beforeEach(async () => {
    mock.restore();

    mockCreateCampaignAsset = mock();
    mockStringifyCampaignAsset = mock();

    mock.module("../../../../MongoDB/campaignAsset/create", () => ({
      createCampaignAsset: mockCreateCampaignAsset,
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

    const module = await import("./createPlot");
    createPlot = module.createPlot;

    mockCreateCampaignAsset.mockResolvedValue(defaultCreatedAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> createPlot creates plot with all fields", async () => {
    const result = await createPlot(defaultPlotInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.Plot,
      name: defaultPlotInput.name,
      gmSummary: defaultPlotInput.gmSummary,
      playerSummary: defaultPlotInput.playerSummary,
      gmNotes: defaultPlotInput.gmNotes,
      playerNotes: defaultPlotInput.playerNotes,
      sessionEventLink: [],
      plotData: {
        status: defaultPlotInput.status,
        urgency: defaultPlotInput.urgency,
      },
    });

    expect(result).toContain("<success>");
    expect(result).toContain("Plot created successfully");
    expect(result).toContain(`id="${defaultCreatedAsset.id}"`);
  });

  test("Unit -> createPlot creates plot with minimal required fields", async () => {
    const minimalInput = {
      name: "Test Plot",
      gmNotes: "Test GM notes",
      playerNotes: "Test player info",
      status: PlotStatus.Unknown,
      urgency: Urgency.Ongoing,
    };

    await createPlot(minimalInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.Plot,
      name: "Test Plot",
      gmSummary: "",
      playerSummary: "",
      gmNotes: "Test GM notes",
      playerNotes: "Test player info",
      sessionEventLink: [],
      plotData: {
        status: PlotStatus.Unknown,
        urgency: Urgency.Ongoing,
      },
    });
  });

  test("Unit -> createPlot validates name length", async () => {
    const invalidInput = {
      ...defaultPlotInput,
      name: "A".repeat(201),
    };

    await expect(
      createPlot(invalidInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> createPlot handles errors with console.error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database error");
    mockCreateCampaignAsset.mockRejectedValue(testError);

    try {
      const result = await createPlot(defaultPlotInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      });

      expect(result).toContain("<error>");
      expect(result).toContain("Failed to create plot");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in createPlot tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });
});
