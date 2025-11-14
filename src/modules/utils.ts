import type {
  AIMessageChunk,
  MessageContentComplex,
} from "@langchain/core/messages";
import type {
  Campaign,
  CampaignAsset,
  Message,
  MessageRoles,
  Thread,
} from "../data/MongoDB";
import type {
  GenerateMessagePayload,
  Campaign as GraphQLCampaign,
  Location as GraphQLLocation,
  Message as GraphQLMessage,
  Npc as GraphQLNPC,
  Plot as GraphQLPlot,
  Role as GraphQLRole,
  Thread as GraphQLThread,
} from "../generated/graphql";

export const TranslateRole = (role: MessageRoles): GraphQLRole => {
  switch (role) {
    case "user":
      return "User";
    case "system":
      return "System";
    case "assistant":
    default:
      return "Assistant";
  }
};

export const TranslateMessage = (message: Message): GraphQLMessage => {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    threadId: message.threadId,
    role: TranslateRole(message.role as MessageRoles),
    tokenCount: message.tokenCount,
    workspace: message.workspace.map((entry) => ({
      messageType: entry.messageType,
      content: entry.content,
      timestamp: entry.timestamp.toISOString(),
      elapsedTime: entry.elapsedTime ?? null,
    })),
  };
};

export const TranslateThread = (thread: Thread): GraphQLThread => {
  return {
    id: thread.id,
    title: thread.title,
    lastUsed: thread.updatedAt.toISOString(),
    campaignId: thread.campaignId,
    messages: [],
  };
};

export const TranslateAIChunk = (
  chunk: AIMessageChunk
): GenerateMessagePayload => {
  let content = "";
  if (typeof chunk.content === "string") {
    content = chunk.content;
  } else {
    const combinedContent = chunk.content.map((c: MessageContentComplex) => {
      if (c.type === "text") {
        return c.text as string;
      }
      if (c.type === "image_url") {
        return (c.image_url as { url?: string })?.url ?? "";
      }
      return "";
    });
    content = combinedContent.join(" ");
  }

  return {
    responseType: "Content",
    content,
  };
};

export const TranslateCampaign = (campaign: Campaign): GraphQLCampaign => {
  return {
    id: campaign.id,
    ownerId: campaign.ownerId,
    name: campaign.name,
    setting: campaign.setting,
    tone: campaign.tone,
    ruleset: campaign.ruleset,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
};

export const TranslateLocation = (asset: CampaignAsset): GraphQLLocation => {
  if (!asset.locationData) {
    throw new Error("Asset is not a Location");
  }

  return {
    id: asset.id,
    campaignId: asset.campaignId,
    name: asset.name,
    summary: asset.summary,
    playerSummary: asset.playerSummary,
    imageUrl: asset.locationData.imageUrl,
    description: asset.locationData.description,
    condition: asset.locationData.condition,
    pointsOfInterest: asset.locationData.pointsOfInterest,
    characters: asset.locationData.characters,
    dmNotes: asset.locationData.dmNotes,
    sharedWithPlayers: asset.locationData.sharedWithPlayers,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
};

export const TranslateNPC = (asset: CampaignAsset): GraphQLNPC => {
  if (!asset.npcData) {
    throw new Error("Asset is not an NPC");
  }

  return {
    id: asset.id,
    campaignId: asset.campaignId,
    name: asset.name,
    summary: asset.summary,
    playerSummary: asset.playerSummary,
    imageUrl: asset.npcData.imageUrl,
    physicalDescription: asset.npcData.physicalDescription,
    motivation: asset.npcData.motivation,
    mannerisms: asset.npcData.mannerisms,
    dmNotes: asset.npcData.dmNotes,
    sharedWithPlayers: asset.npcData.sharedWithPlayers,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
};

export const TranslatePlot = (asset: CampaignAsset): GraphQLPlot => {
  if (!asset.plotData) {
    throw new Error("Asset is not a Plot");
  }

  return {
    id: asset.id,
    campaignId: asset.campaignId,
    name: asset.name,
    summary: asset.plotData.summary,
    status: asset.plotData.status,
    urgency: asset.plotData.urgency,
    relatedAssets: asset.plotData.relatedAssets.map((rel) => ({
      relatedAssetId: rel.relatedAssetId,
      relationshipSummary: rel.relationshipSummary,
    })),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
};
