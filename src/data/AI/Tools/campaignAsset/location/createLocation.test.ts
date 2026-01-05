import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { RecordType } from "@prisma/client";
import { RequestContext } from "../../../types";

describe("createLocation", () => {
  // Declare mock variables
  let mockCreateCampaignAsset: ReturnType<typeof mock>;
  let mockStringifyCampaignAsset: ReturnType<typeof mock>;
  let createLocation: typeof import("./createLocation").createLocation;
  let mockYieldMessage: ReturnType<typeof mock>;

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

  const defaultLocationInput = {
    name: "The Rusty Dragon Inn",
    gmSummary: "A popular tavern in town",
    gmNotes: "Secret passage in cellar leads to smuggler's cave",
    playerSummary: "A cozy inn",
    playerNotes: "The inn is popular with adventurers",
    imageUrl: "https://example.com/inn.jpg",
    description: "A warm, inviting tavern with crackling fireplace",
    condition: "Well-maintained",
    pointsOfInterest: "Bar, rooms upstairs, secret cellar",
    characters: "Innkeeper Ameiko, various patrons",
  };

  const defaultCreatedAsset: CampaignAsset = {
    id: "asset-location-1",
    campaignId: defaultCampaignId,
    name: defaultLocationInput.name,
    recordType: RecordType.Location,
    gmSummary: defaultLocationInput.gmSummary,
    gmNotes: defaultLocationInput.gmNotes,
    playerSummary: defaultLocationInput.playerSummary,
    playerNotes: defaultLocationInput.playerNotes,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    Embeddings: [],
    locationData: {
      imageUrl: defaultLocationInput.imageUrl,
      description: defaultLocationInput.description,
      condition: defaultLocationInput.condition,
      pointsOfInterest: defaultLocationInput.pointsOfInterest,
      characters: defaultLocationInput.characters,
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
    mockYieldMessage = mock();

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
    defaultContext = {
      userId: defaultUserId,
      campaignId: defaultCampaignId,
      threadId: defaultThreadId,
      runId: defaultRunId,
      yieldMessage: mockYieldMessage,
    };
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> createLocation creates location with all fields", async () => {
    const result = await createLocation(defaultLocationInput, {
      context: defaultContext,
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.Location,
      name: defaultLocationInput.name,
      gmSummary: defaultLocationInput.gmSummary,
      gmNotes: defaultLocationInput.gmNotes,
      playerSummary: defaultLocationInput.playerSummary,
      playerNotes: defaultLocationInput.playerNotes,
      sessionEventLink: [],
      locationData: {
        imageUrl: defaultLocationInput.imageUrl,
        description: defaultLocationInput.description,
        condition: defaultLocationInput.condition,
        pointsOfInterest: defaultLocationInput.pointsOfInterest,
        characters: defaultLocationInput.characters,
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
      gmNotes: "Hidden treasure",
      gmSummary: "asdf",
      description: "A dark cave",
      condition: "Natural",
      pointsOfInterest: "None",
      characters: "None",
      imageUrl: "",
    };

    await createLocation(minimalInput, {
      context: defaultContext,
    });

    expect(mockCreateCampaignAsset).toHaveBeenCalledWith({
      campaignId: defaultCampaignId,
      recordType: RecordType.Location,
      name: minimalInput.name,
      gmSummary: minimalInput.gmSummary,
      gmNotes: minimalInput.gmNotes,
      playerSummary: "",
      playerNotes: "",
      sessionEventLink: [],
      locationData: {
        description: minimalInput.description,
        condition: minimalInput.condition,
        pointsOfInterest: minimalInput.pointsOfInterest,
        characters: minimalInput.characters,
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
        context: defaultContext,
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
        context: defaultContext,
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
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation validates gmSummary character limit (200 max)", async () => {
    const invalidInput = {
      ...defaultLocationInput,
      gmSummary: "A".repeat(201), // Exceeds 200 character limit
    };

    await expect(
      createLocation(invalidInput, {
        context: defaultContext,
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
        context: defaultContext,
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
        context: defaultContext,
      })
    ).rejects.toThrow();
  });

  test("Unit -> createLocation accepts exactly 200 characters for gmSummary", async () => {
    const validInput = {
      ...defaultLocationInput,
      gmSummary: "A".repeat(200), // Exactly 200 characters
    };

    const result = await createLocation(validInput, {
      context: defaultContext,
    });

    expect(result).toContain("<success>");
  });

  test("Unit -> createLocation returns XML formatted response", async () => {
    const result = await createLocation(defaultLocationInput, {
      context: defaultContext,
    });

    expect(result).toMatch(/<success>.*<\/success>/s);
    expect(result).toMatch(/<location id="[^"]+" name="[^"]+">.*<\/location>/s);
  });
});
