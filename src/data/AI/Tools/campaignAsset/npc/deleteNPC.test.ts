import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("deleteNPC", () => {
  // Declare mock variables
  let mockVerifyCampaignAssetOwnership: ReturnType<typeof mock>;
  let mockGetCampaignAssetById: ReturnType<typeof mock>;
  let mockDeleteCampaignAsset: ReturnType<typeof mock>;
  let deleteNPC: typeof import("./deleteNPC").deleteNPC;

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

    mock.module("../../../Agents/characterAgent", () => ({
      characterAgent: {
        name: "character_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./deleteNPC");
    deleteNPC = module.deleteNPC;

    // Configure default behavior
    mockVerifyCampaignAssetOwnership.mockResolvedValue(undefined);
    mockGetCampaignAssetById.mockResolvedValue(defaultExistingAsset);
    mockDeleteCampaignAsset.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> deleteNPC deletes NPC successfully", async () => {
    const result = await deleteNPC(
      { npcId: defaultNPCId },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(mockVerifyCampaignAssetOwnership).toHaveBeenCalledWith(
      defaultNPCId,
      defaultUserId
    );
    expect(mockGetCampaignAssetById).toHaveBeenCalledWith({
      assetId: defaultNPCId,
      recordType: RecordType.NPC,
    });
    expect(mockDeleteCampaignAsset).toHaveBeenCalledWith({
      assetId: defaultNPCId,
    });

    expect(result).toContain("<success>");
    expect(result).toContain("Elara Moonwhisper");
    expect(result).toContain("permanently deleted");
  });

  test("Unit -> deleteNPC verifies ownership before deletion", async () => {
    await deleteNPC(
      { npcId: defaultNPCId },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(mockVerifyCampaignAssetOwnership).toHaveBeenCalledWith(
      defaultNPCId,
      defaultUserId
    );
    expect(mockDeleteCampaignAsset).toHaveBeenCalled();
  });

  test("Unit -> deleteNPC returns error when NPC not found", async () => {
    mockGetCampaignAssetById.mockResolvedValue(null);

    const result = await deleteNPC(
      { npcId: "non-existent-id" },
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
    expect(mockDeleteCampaignAsset).not.toHaveBeenCalled();
  });

  test("Unit -> deleteNPC returns error when user not authorized", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const authError = new Error("User not authorized to access this asset");
    mockVerifyCampaignAssetOwnership.mockRejectedValue(authError);

    try {
      const result = await deleteNPC(
        { npcId: defaultNPCId },
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
      expect(mockDeleteCampaignAsset).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> deleteNPC handles deletion failure", async () => {
    mockDeleteCampaignAsset.mockResolvedValue({ success: false });

    const result = await deleteNPC(
      { npcId: defaultNPCId },
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
    expect(result).toContain("Failed to delete NPC");
  });

  test("Unit -> deleteNPC handles generic errors", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const genericError = new Error("Database connection failed");
    mockDeleteCampaignAsset.mockRejectedValue(genericError);

    try {
      const result = await deleteNPC(
        { npcId: defaultNPCId },
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
      expect(result).toContain("Failed to delete NPC");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in deleteNPC tool:",
        genericError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> deleteNPC returns success message with NPC name and ID", async () => {
    const result = await deleteNPC(
      { npcId: defaultNPCId },
      {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      }
    );

    expect(result).toContain(`"${defaultExistingAsset.name}"`);
    expect(result).toContain(`ID: ${defaultNPCId}`);
    expect(result).toMatch(/<success>.*<\/success>/s);
  });
});
