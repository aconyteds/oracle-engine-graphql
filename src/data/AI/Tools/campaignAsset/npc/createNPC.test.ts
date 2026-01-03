import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";
import { RequestContext } from "../../../types";

describe("createNPC", () => {
  // Declare mock variables
  let mockCreateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let createNPC: typeof import("./createNPC").createNPC;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";
  let defaultContext: RequestContext = {
    userId: defaultUserId,
    campaignId: defaultCampaignId,
    threadId: defaultThreadId,
    runId: defaultRunId,
    yieldMessage: () => {},
  };

  const defaultNPCInput = {
    name: "Elara Moonwhisper",
    gmSummary: "Elven ranger tracking a dangerous beast",
    playerSummary: "A helpful elf ranger",
    imageUrl: "https://example.com/elara.jpg",
    physicalDescription:
      "A lithe elf woman in her 120s, dressed in forest greens. Her silver hair is tied back, and her green eyes scan constantly. She smells of pine and carries a longbow. Her voice is soft but carries authority.",
    motivation:
      "Protect the forest from encroaching corruption and avenge her murdered mentor",
    mannerisms:
      "Speaks softly, constantly checking surroundings, whistles to birds, touches trees when nervous",
    gmNotes:
      "Secretly working for the Shadow Council. Has information about the ancient temple. Stats: AC 16, HP 52, skilled archer.",
    playerNotes:
      "She seems friendly and offers to guide the party through the Mistwood",
  };

  const defaultCreatedAsset: CampaignAsset = {
    id: "asset-npc-1",
    campaignId: defaultCampaignId,
    name: "Elara Moonwhisper",
    recordType: RecordType.NPC,
    gmSummary: "Elven ranger tracking a dangerous beast",
    playerSummary: "A helpful elf ranger",
    gmNotes:
      "Secretly working for the Shadow Council. Has information about the ancient temple. Stats: AC 16, HP 52, skilled archer.",
    playerNotes:
      "She seems friendly and offers to guide the party through the Mistwood",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    npcData: {
      imageUrl: "https://example.com/elara.jpg",
      physicalDescription:
        "A lithe elf woman in her 120s, dressed in forest greens. Her silver hair is tied back, and her green eyes scan constantly. She smells of pine and carries a longbow. Her voice is soft but carries authority.",
      motivation:
        "Protect the forest from encroaching corruption and avenge her murdered mentor",
      mannerisms:
        "Speaks softly, constantly checking surroundings, whistles to birds, touches trees when nervous",
    },
    locationData: null,
    plotData: null,
    sessionEventLink: [],
  };

  const defaultStringifiedAsset =
    "Name: Elara Moonwhisper\nPhysical Description: A lithe elf woman...";

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockCreateCampaignAsset = mock();
    mockStringifyCampaignAsset = mock();

    mock.module("../../../../MongoDB/campaignAsset/embedCampaignAsset", () => ({
      embedCampaignAsset: mock(),
      stringifyCampaignAsset: mockStringifyCampaignAsset,
    }));

    // Set up module mocks - mock specific submodules instead of barrel exports
    mock.module("../../../../MongoDB/campaignAsset/create", () => ({
      createCampaignAsset: mockCreateCampaignAsset,
    }));

    // Mock createEmbeddings to prevent circular dependency via agentList
    mock.module("../../createEmbeddings", () => ({
      createEmbeddings: mock(),
    }));

    // Mock the characterAgent to break circular dependency
    mock.module("../../../Agents/characterAgent", () => ({
      characterAgent: {
        name: "character_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./createNPC");
    createNPC = module.createNPC;

    // Configure default behavior
    mockCreateCampaignAsset.mockResolvedValue(defaultCreatedAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
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

  test("Unit -> createNPC creates NPC with all fields", async () => {
    const result = await createNPC(defaultNPCInput, {
      context: defaultContext,
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.NPC,
      name: defaultNPCInput.name,
      gmSummary: defaultNPCInput.gmSummary,
      playerSummary: defaultNPCInput.playerSummary,
      gmNotes: defaultNPCInput.gmNotes,
      playerNotes: defaultNPCInput.playerNotes,
      sessionEventLink: [],
      npcData: {
        imageUrl: defaultNPCInput.imageUrl,
        physicalDescription: defaultNPCInput.physicalDescription,
        motivation: defaultNPCInput.motivation,
        mannerisms: defaultNPCInput.mannerisms,
      },
    });

    expect(result).toContain("<success>");
    expect(result).toContain("NPC created successfully");
    expect(result).toContain("<npc");
    expect(result).toContain('id="asset-npc-1"');
    expect(result).toContain(defaultStringifiedAsset);
  });

  test("Unit -> createNPC creates NPC with minimal required fields", async () => {
    const minimalInput = {
      name: "Grunk",
      physicalDescription: "A gruff orc blacksmith in his 40s",
      motivation: "Make the finest weapons",
      mannerisms: "Grunts often, spits when angry",
      gmNotes: "Has legendary sword hidden in shop",
      gmSummary: "asdf",
      imageUrl: "",
    };

    await createNPC(minimalInput, {
      context: defaultContext,
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.NPC,
      name: minimalInput.name,
      gmSummary: minimalInput.gmSummary,
      playerSummary: "",
      gmNotes: minimalInput.gmNotes,
      playerNotes: "",
      sessionEventLink: [],
      npcData: {
        physicalDescription: minimalInput.physicalDescription,
        motivation: minimalInput.motivation,
        mannerisms: minimalInput.mannerisms,
      },
    });
  });

  test("Unit -> createNPC handles errors with console.error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database write failed");
    mockCreateCampaignAsset.mockRejectedValue(testError);

    try {
      const result = await createNPC(defaultNPCInput, {
        context: defaultContext,
      });

      expect(result).toContain("<error>");
      expect(result).toContain("Failed to create NPC");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in createNPC tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createNPC validates name length", async () => {
    const invalidInput = {
      ...defaultNPCInput,
      name: "X", // Too short
    };

    await expect(
      createNPC(invalidInput, {
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createNPC validates imageUrl format", async () => {
    const invalidInput = {
      ...defaultNPCInput,
      imageUrl: "not-a-valid-url",
    };

    await expect(
      createNPC(invalidInput, {
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createNPC validates gmSummary character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultNPCInput,
      gmSummary: "A".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createNPC(invalidInput, {
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createNPC validates playerSummary character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultNPCInput,
      playerSummary: "B".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createNPC(invalidInput, {
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createNPC validates name character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultNPCInput,
      name: "C".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createNPC(invalidInput, {
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createNPC accepts exactly 200 characters for gmSummary", async () => {
    const validInput = {
      ...defaultNPCInput,
      gmSummary: "A".repeat(200), // Exactly 200 characters
    };

    const result = await createNPC(validInput, {
      context: defaultContext,
    });

    expect(result).toContain("<success>");
  });

  test("Unit -> createNPC returns XML formatted response", async () => {
    const result = await createNPC(defaultNPCInput, {
      context: defaultContext,
    });

    expect(result).toMatch(/<success>.*<\/success>/s);
    expect(result).toMatch(/<npc id="[^"]+" name="[^"]+">.*<\/npc>/s);
  });
});
