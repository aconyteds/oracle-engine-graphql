import { describe, expect, test } from "bun:test";
import type { CampaignAsset } from "@prisma/client";
import { PlotStatus, RecordType, Urgency } from "@prisma/client";
import {
  translateCampaignAsset,
  translateCampaignAssetData,
} from "./translators";

describe("translateCampaignAssetData", () => {
  // Default mock data - reusable across tests
  const defaultCampaignId = "507f1f77bcf86cd799439011";
  const defaultAssetId = "507f1f77bcf86cd799439012";

  const defaultLocationData = {
    imageUrl: "https://example.com/location.jpg",
    description: "A dark and mysterious forest",
    condition: "Dense foliage, difficult terrain",
    pointsOfInterest: "Ancient ruins, hidden cave",
    characters: "Forest guardian, local bandits",
  };

  const defaultNPCData = {
    imageUrl: "https://example.com/npc.jpg",
    physicalDescription: "A tall elf with silver hair",
    motivation: "Seeking revenge for their fallen village",
    mannerisms: "Speaks softly, avoids eye contact",
  };

  const defaultPlotData = {
    status: PlotStatus.InProgress,
    urgency: Urgency.TimeSensitive,
    relatedAssetList: [],
  };

  const baseAsset = {
    id: defaultAssetId,
    campaignId: defaultCampaignId,
    name: "Test Asset",
    gmSummary: "Test summary",
    gmNotes: "GM notes",
    playerSummary: "Player summary",
    playerNotes: "Player notes",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    Embeddings: [],
    sessionEventLink: [],
  };

  test("Unit -> translateCampaignAssetData returns LocationData with __typename for Location assets", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.Location,
      locationData: defaultLocationData,
      npcData: null,
      plotData: null,
    };

    const result = translateCampaignAssetData(asset);

    expect(result).toEqual({
      __typename: "LocationData",
      imageUrl: defaultLocationData.imageUrl,
      description: defaultLocationData.description,
      condition: defaultLocationData.condition,
      pointsOfInterest: defaultLocationData.pointsOfInterest,
      characters: defaultLocationData.characters,
    });
  });

  test("Unit -> translateCampaignAssetData returns NPCData with __typename for NPC assets", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.NPC,
      locationData: null,
      npcData: defaultNPCData,
      plotData: null,
    };

    const result = translateCampaignAssetData(asset);

    expect(result).toEqual({
      __typename: "NPCData",
      imageUrl: defaultNPCData.imageUrl,
      physicalDescription: defaultNPCData.physicalDescription,
      motivation: defaultNPCData.motivation,
      mannerisms: defaultNPCData.mannerisms,
    });
  });

  test("Unit -> translateCampaignAssetData returns PlotData with __typename for Plot assets", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.Plot,
      locationData: null,
      npcData: null,
      plotData: defaultPlotData,
    };

    const result = translateCampaignAssetData(asset);

    expect(result).toEqual({
      __typename: "PlotData",
      status: defaultPlotData.status,
      urgency: defaultPlotData.urgency,
    });
  });

  test("Unit -> translateCampaignAssetData handles LocationData with null imageUrl", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.Location,
      locationData: {
        ...defaultLocationData,
        imageUrl: null,
      },
      npcData: null,
      plotData: null,
    };

    const result = translateCampaignAssetData(asset);

    expect(result).toHaveProperty("__typename", "LocationData");
    expect(result).toHaveProperty("imageUrl", null);
  });

  test("Unit -> translateCampaignAssetData handles NPCData with null imageUrl", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.NPC,
      locationData: null,
      npcData: {
        ...defaultNPCData,
        imageUrl: null,
      },
      plotData: null,
    };

    const result = translateCampaignAssetData(asset);

    expect(result).toHaveProperty("__typename", "NPCData");
    expect(result).toHaveProperty("imageUrl", null);
  });

  test("Unit -> translateCampaignAssetData throws error for Location asset without locationData", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.Location,
      locationData: null,
      npcData: null,
      plotData: null,
    };

    expect(() => translateCampaignAssetData(asset)).toThrow(
      `Asset ${defaultAssetId} is marked as Location but has no locationData`
    );
  });

  test("Unit -> translateCampaignAssetData throws error for NPC asset without npcData", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.NPC,
      locationData: null,
      npcData: null,
      plotData: null,
    };

    expect(() => translateCampaignAssetData(asset)).toThrow(
      `Asset ${defaultAssetId} is marked as NPC but has no npcData`
    );
  });

  test("Unit -> translateCampaignAssetData throws error for Plot asset without plotData", () => {
    const asset: CampaignAsset = {
      ...baseAsset,
      recordType: RecordType.Plot,
      locationData: null,
      npcData: null,
      plotData: null,
    };

    expect(() => translateCampaignAssetData(asset)).toThrow(
      `Asset ${defaultAssetId} is marked as Plot but has no plotData`
    );
  });
});

describe("translateCampaignAsset", () => {
  const defaultCampaignId = "507f1f77bcf86cd799439011";
  const defaultAssetId = "507f1f77bcf86cd799439012";

  const baseAsset2 = {
    id: defaultAssetId,
    campaignId: defaultCampaignId,
    name: "Dark Forest",
    recordType: RecordType.Location,
    gmSummary: "A mysterious forest",
    gmNotes: "Hidden treasure map in the ruins",
    playerSummary: "Known for disappearances",
    playerNotes: "The forest is known for strange disappearances",
    createdAt: new Date("2024-01-01T12:00:00Z"),
    updatedAt: new Date("2024-01-02T14:30:00Z"),
    Embeddings: [],
    sessionEventLink: [],
    locationData: {
      imageUrl: "https://example.com/location.jpg",
      description: "A dark and mysterious forest",
      condition: "Dense foliage, difficult terrain",
      pointsOfInterest: "Ancient ruins, hidden cave",
      characters: "Forest guardian, local bandits",
    },
    npcData: null,
    plotData: null,
  };

  test("Unit -> translateCampaignAsset translates all base fields correctly", () => {
    const asset: CampaignAsset = baseAsset2;

    const result = translateCampaignAsset(asset);

    expect(result.id).toBe(defaultAssetId);
    expect(result.campaignId).toBe(defaultCampaignId);
    expect(result.name).toBe("Dark Forest");
    expect(result.recordType).toBe(RecordType.Location);
    expect(result.gmSummary).toBe("A mysterious forest");
    expect(result.gmNotes).toBe("Hidden treasure map in the ruins");
    expect(result.playerSummary).toBe("Known for disappearances");
    expect(result.playerNotes).toBe(
      "The forest is known for strange disappearances"
    );
    expect(result.createdAt).toBe("2024-01-01T12:00:00.000Z");
    expect(result.updatedAt).toBe("2024-01-02T14:30:00.000Z");
  });

  test("Unit -> translateCampaignAsset handles null gmSummary", () => {
    const asset: CampaignAsset = {
      ...baseAsset2,
      gmSummary: null,
    };

    const result = translateCampaignAsset(asset);

    expect(result.gmSummary).toBe(null);
  });

  test("Unit -> translateCampaignAsset handles null playerSummary and playerNotes", () => {
    const asset: CampaignAsset = {
      ...baseAsset2,
      playerSummary: null,
      playerNotes: null,
    };

    const result = translateCampaignAsset(asset);

    expect(result.playerSummary).toBeNull();
    expect(result.playerNotes).toBe(""); // Non-null field defaults to empty string
  });

  test("Unit -> translateCampaignAsset passes through asset for data field resolver", () => {
    const asset: CampaignAsset = baseAsset2;

    const result = translateCampaignAsset(asset);

    // The data field should contain the original asset for the field resolver
    expect(result.data).toBeDefined();
  });

  test("Unit -> translateCampaignAsset converts dates to ISO strings", () => {
    const asset: CampaignAsset = {
      ...baseAsset2,
      createdAt: new Date("2024-03-15T10:30:00Z"),
      updatedAt: new Date("2024-03-16T15:45:30Z"),
    };

    const result = translateCampaignAsset(asset);

    expect(result.createdAt).toBe("2024-03-15T10:30:00.000Z");
    expect(result.updatedAt).toBe("2024-03-16T15:45:30.000Z");
  });
});
