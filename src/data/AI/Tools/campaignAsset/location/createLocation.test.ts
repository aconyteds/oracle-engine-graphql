import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";

describe("createLocation", () => {
  // Declare mock variables
  let mockCreateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let createLocation: typeof import("./createLocation").createLocation;

  // Default test data
  const defaultCampaignId = "campaign-123";
  const defaultUserId = "user-456";
  const defaultThreadId = "thread-789";
  const defaultRunId = "run-abc";

  const defaultLocationInput = {
    name: "The Rusty Dragon Inn",
    summary: "A popular tavern in town",
    playerSummary: "A cozy inn",
    imageUrl: "https://example.com/inn.jpg",
    description: "A warm, inviting tavern with crackling fireplace",
    condition: "Well-maintained",
    pointsOfInterest: "Bar, rooms upstairs, secret cellar",
    characters: "Innkeeper Ameiko, various patrons",
    dmNotes: "Secret passage in cellar leads to smuggler's cave",
    sharedWithPlayers: "The inn is popular with adventurers",
  };

  const defaultCreatedAsset: CampaignAsset = {
    id: "asset-location-1",
    campaignId: defaultCampaignId,
    name: defaultLocationInput.name,
    recordType: RecordType.Location,
    summary: defaultLocationInput.summary,
    playerSummary: defaultLocationInput.playerSummary,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    locationData: {
      imageUrl: defaultLocationInput.imageUrl,
      description: defaultLocationInput.description,
      condition: defaultLocationInput.condition,
      pointsOfInterest: defaultLocationInput.pointsOfInterest,
      characters: defaultLocationInput.characters,
      dmNotes: defaultLocationInput.dmNotes,
      sharedWithPlayers: defaultLocationInput.sharedWithPlayers,
    },
    plotData: null,
    npcData: null,
    sessionEventLink: [],
  };

  const defaultStringifiedAsset =
    "Name: The Rusty Dragon Inn\nDescription: A warm, inviting tavern";

  beforeEach(async () => {
    mock.restore();

    // Create fresh mocks
    mockCreateCampaignAsset = mock();
    mockStringifyCampaignAsset = mock();

    mock.module("../../../../MongoDB/campaignAsset/embedCampaignAsset", () => ({
      embedCampaignAsset: mock(), // Export all from the module even if unused
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

    // Mock the locationAgent to break circular dependency
    mock.module("../../../Agents/locationAgent", () => ({
      locationAgent: {
        name: "location_agent",
        availableTools: [],
      },
    }));

    // Dynamic import
    const module = await import("./createLocation");
    createLocation = module.createLocation;

    // Configure default behavior
    mockCreateCampaignAsset.mockResolvedValue(defaultCreatedAsset);
    mockStringifyCampaignAsset.mockResolvedValue(defaultStringifiedAsset);
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> createLocation creates location with all fields", async () => {
    const result = await createLocation(defaultLocationInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.Location,
      name: defaultLocationInput.name,
      summary: defaultLocationInput.summary,
      playerSummary: defaultLocationInput.playerSummary,
      sessionEventLink: [],
      relatedAssetList: [],
      locationData: {
        imageUrl: defaultLocationInput.imageUrl,
        description: defaultLocationInput.description,
        condition: defaultLocationInput.condition,
        pointsOfInterest: defaultLocationInput.pointsOfInterest,
        characters: defaultLocationInput.characters,
        dmNotes: defaultLocationInput.dmNotes,
        sharedWithPlayers: defaultLocationInput.sharedWithPlayers,
      },
    });

    expect(result).toContain("<success>");
    expect(result).toContain("Location created successfully");
    expect(result).toContain("<location");
    expect(result).toContain('id="asset-location-1"');
    expect(result).toContain(defaultStringifiedAsset);
  });

  test("Unit -> createLocation creates location with minimal required fields", async () => {
    const minimalInput = {
      name: "Simple Cave",
      description: "A dark cave",
      condition: "Natural",
      pointsOfInterest: "None",
      characters: "None",
      dmNotes: "Hidden treasure",
      sharedWithPlayers: "Entrance visible from road",
      imageUrl: "",
    };

    await createLocation(minimalInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.Location,
      name: minimalInput.name,
      summary: "",
      playerSummary: "",
      sessionEventLink: [],
      relatedAssetList: [],
      locationData: {
        imageUrl: undefined,
        description: minimalInput.description,
        condition: minimalInput.condition,
        pointsOfInterest: minimalInput.pointsOfInterest,
        characters: minimalInput.characters,
        dmNotes: minimalInput.dmNotes,
        sharedWithPlayers: minimalInput.sharedWithPlayers,
      },
    });
  });

  test("Unit -> createLocation handles errors with console.error", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Database write failed");
    mockCreateCampaignAsset.mockRejectedValue(testError);

    try {
      const result = await createLocation(defaultLocationInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      });

      expect(result).toContain("<error>");
      expect(result).toContain("Failed to create location");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error in createLocation tool:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createLocation validates name length", async () => {
    const invalidInput = {
      ...defaultLocationInput,
      name: "X", // Too short
    };

    await expect(
      createLocation(invalidInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation validates imageUrl format", async () => {
    const invalidInput = {
      ...defaultLocationInput,
      imageUrl: "not-a-valid-url",
    };

    await expect(
      createLocation(invalidInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation validates summary character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultLocationInput,
      summary: "A".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createLocation(invalidInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation validates playerSummary character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultLocationInput,
      playerSummary: "B".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createLocation(invalidInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation validates name character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultLocationInput,
      name: "C".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createLocation(invalidInput, {
        context: {
          userId: defaultUserId,
          campaignId: defaultCampaignId,
          threadId: defaultThreadId,
          runId: defaultRunId,
        },
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation accepts exactly 200 characters for summary", async () => {
    const validInput = {
      ...defaultLocationInput,
      summary: "A".repeat(200), // Exactly 200 characters
    };

    const result = await createLocation(validInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(result).toContain("<success>");
  });

  test("Unit -> createLocation returns XML formatted response", async () => {
    const result = await createLocation(defaultLocationInput, {
      context: {
        userId: defaultUserId,
        campaignId: defaultCampaignId,
        threadId: defaultThreadId,
        runId: defaultRunId,
      },
    });

    expect(result).toMatch(/<success>.*<\/success>/s);
    expect(result).toMatch(/<location id="[^"]+" name="[^"]+">.*<\/location>/s);
  });
});
