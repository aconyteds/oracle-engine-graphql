import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("findNPCByName", () => {
  // Declare mock variables
  let mockFindCampaignAssetByName: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let findNPCByName: typeof import("./findNPCByName").findNPCByName;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";

  const defaultFoundAsset: CampaignAsset = {
    id: "npc-001",
    campaignId: defaultCampaignId,
    name: "Elara Moonwhisper",
    recordType: RecordType.NPC,
    summary: "Elven ranger",
    playerSummary: "A helpful elf",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    npcData: {
      imageUrl: "https://example.com/elara.jpg",
      physicalDescription: "A lithe elf woman",
      motivation: "Protect the forest",
      mannerisms: "Speaks softly",
      dmNotes: "Secretly working for Shadow Council",
      sharedWithPlayers: "Seems friendly",
    },
    locationData: null,
    plotData: null,
    sessionEventLink: [],
  };

  const defaultStringifiedAsset = "Name: Elara Moonwhisper\nDetails...";

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

    mock.module("../../../Agents/characterAgent", () => ({
      characterAgent: {
        name: "character_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./findNPCByName");
    findNPCByName = module.findNPCByName;

    // Configure default behavior
    mockFindCampaignAssetByName.mockResolvedValue(defaultFoundAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> findNPCByName finds NPC by exact name", async () => {
    const result = await findNPCByName(
      { name: "Elara Moonwhisper" },
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
      name: "Elara Moonwhisper",
      recordType: RecordType.NPC,
    });

    expect(result).toContain("<npc");
    expect(result).toContain('id="npc-001"');
    expect(result).toContain('name="Elara Moonwhisper"');
    expect(result).toContain(defaultStringifiedAsset);
  });

  test("Unit -> findNPCByName returns helpful message when not found", async () => {
    mockFindCampaignAssetByName.mockResolvedValue(null);

    const result = await findNPCByName(
      { name: "Unknown NPC" },
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
    expect(result).toContain("No NPC found");
    expect(result).toContain("Unknown NPC");
    expect(result).toContain("find_campaign_asset");
    expect(result).toContain("semantic search");
  });

  test("Unit -> findNPCByName handles errors with console.error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database query failed");
    mockFindCampaignAssetByName.mockRejectedValue(testError);

    try {
      const result = await findNPCByName(
        { name: "Test NPC" },
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
        "Error in findNPCByName tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> findNPCByName returns XML formatted response", async () => {
    const result = await findNPCByName(
      { name: "Elara Moonwhisper" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toMatch(/<npc id="[^"]+" name="[^"]+">.*<\/npc>/s);
  });

  test("Unit -> findNPCByName filters by NPC recordType", async () => {
    await findNPCByName(
      { name: "Elara Moonwhisper" },
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
    expect(callArgs.recordType).toBe(RecordType.NPC);
  });
});
