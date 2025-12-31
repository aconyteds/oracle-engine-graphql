import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("updateNPC", () => {
  // Declare mock variables
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockUpdateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let updateNPC: typeof import("./updateNPC").updateNPC;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";
  const defaultNPCId = "npc-001";

  const defaultExistingAsset: CampaignAsset = {
    id: defaultNPCId,
    campaignId: defaultCampaignId,
    name: "Elara Moonwhisper",
    recordType: RecordType.NPC,
    gmSummary: "Elven ranger",
    playerSummary: "A helpful elf",
    gmNotes: "Secretly working for Shadow Council",
    playerNotes: "Seems friendly",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    npcData: {
      imageUrl: "https://example.com/elara.jpg",
      physicalDescription: "A lithe elf woman",
      motivation: "Protect the forest",
      mannerisms: "Speaks softly",
    },
    locationData: null,
    plotData: null,
    sessionEventLink: [],
  };

  const defaultUpdatedAsset: CampaignAsset = {
    ...defaultExistingAsset,
    gmSummary: "Elven ranger who betrayed the party",
    updatedAt: new Date("2024-01-02"),
  };

  const defaultStringifiedAsset = "Name: Elara Moonwhisper\nUpdated info...";

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockVerifyCampaignAssetOwnership = mock();
    mockGetCampaignAssetById = mock();
    mockUpdateCampaignAsset = mock();
    mockStringifyCampaignAsset = mock();

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

    mock.module("../../../../MongoDB/campaignAsset/update", () => ({
      updateCampaignAsset: mockUpdateCampaignAsset,
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
    const module = await import("./updateNPC");
    updateNPC = module.updateNPC;

    // Configure default behavior
    mockVerifyCampaignAssetOwnership.mockResolvedValue(undefined);
    mockGetCampaignAssetById.mockResolvedValue(defaultExistingAsset);
    mockUpdateCampaignAsset.mockResolvedValue(defaultUpdatedAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> updateNPC updates NPC with partial fields", async () => {
    const updateInput = {
      npcId: defaultNPCId,
      gmSummary: "Elven ranger who betrayed the party",
      gmNotes: "Revealed as Shadow Council agent",
    };

    const result = await updateNPC(updateInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(mockVerifyCampaignAssetOwnership).toHaveBeenCalledWith(
      defaultNPCId,
      defaultUserId
    );
    expect(mockGetCampaignAssetById).toHaveBeenCalledWith({
      assetId: defaultNPCId,
      recordType: RecordType.NPC,
    });
    expect(mockUpdateCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultNPCId,
      recordType: RecordType.NPC,
      name: undefined,
      gmSummary: updateInput.gmSummary,
      playerSummary: undefined,
      gmNotes: updateInput.gmNotes,
      playerNotes: undefined,
      npcData: undefined,
    });

    expect(result).toContain("<success>");
    expect(result).toContain("NPC updated successfully");
    expect(result).toContain("<npc");
  });

  test("Unit -> updateNPC updates name and gmSummary", async () => {
    const updateInput = {
      npcId: defaultNPCId,
      name: "Elara the Betrayer",
      gmSummary: "Former ally turned enemy",
    };

    await updateNPC(updateInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(mockUpdateCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultNPCId,
      recordType: RecordType.NPC,
      name: updateInput.name,
      gmSummary: updateInput.gmSummary,
      playerSummary: undefined,
      gmNotes: undefined,
      playerNotes: undefined,
      npcData: undefined,
    });
  });

  test("Unit -> updateNPC returns error when NPC not found", async () => {
    mockGetCampaignAssetById.mockResolvedValue(null);

    const result = await updateNPC(
      { npcId: "non-existent-id", gmSummary: "Test" },
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
    expect(result).toContain("not found or is not an NPC");
  });

  test("Unit -> updateNPC returns error when user not authorized", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const authError = new Error("User not authorized to access this asset");
    mockVerifyCampaignAssetOwnership.mockRejectedValue(authError);

    try {
      const result = await updateNPC(
        { npcId: defaultNPCId, gmSummary: "Test" },
        {
          context: {
            userId: "wrong-user",
            campaignId: defaultCampaignId,
            threadId: defaultThreadId,
            runId: defaultRunId,
          },
        }
      );

      expect(result).toContain("<error>");
      expect(result).toContain("not authorized");
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateNPC returns error for type mismatch", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const typeError = new Error("Asset type mismatch - expected NPC");
    mockUpdateCampaignAsset.mockRejectedValue(typeError);

    try {
      const result = await updateNPC(
        { npcId: defaultNPCId, gmSummary: "Test" },
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
      expect(result).toContain("not an NPC");
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateNPC handles generic errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const genericError = new Error("Database connection failed");
    mockUpdateCampaignAsset.mockRejectedValue(genericError);

    try {
      const result = await updateNPC(
        { npcId: defaultNPCId, gmSummary: "Test" },
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
      expect(result).toContain("Failed to update NPC");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in updateNPC tool:",
        genericError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> updateNPC returns XML formatted response", async () => {
    const result = await updateNPC(
      { npcId: defaultNPCId, gmSummary: "Updated gmSummary" },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toMatch(/<success>.*<\/success>/s);
    expect(result).toMatch(/<npc id="[^"]+" name="[^"]+">.*<\/npc>/s);
  });
});
