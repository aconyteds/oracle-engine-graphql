import type DataLoader from "dataloader";
import { initializeFirebase, verifyUser } from "./data/Firebase";
import type { Thread, User } from "./data/MongoDB";
import PubSub from "./graphql/topics";
import { createThreadsByCampaignIdLoader } from "./modules/Thread/dataloader";
import { logger } from "./utils/logger";

export interface ServerContext {
  // The Firebase Auth token, if available.
  token?: string;
  // The Currently logged in user
  user: User | null;
  // The PubSub instance for publishing and subscribing to events.
  pubsub: typeof PubSub;
  // The campaign ID the user has selected, if any.
  selectedCampaignId?: string;
  // DataLoaders for batching database queries
  loaders: {
    threadsByCampaignId: DataLoader<string, Thread[]>;
  };
}

// Initialize Firebase Admin SDK
initializeFirebase();

export const getContext = async ({
  req,
  connectionParams,
}: {
  req?: { headers?: Record<string, unknown> };
  connectionParams?: Record<string, unknown>;
}): Promise<ServerContext> => {
  let token = "";
  let selectedCampaignId: string | undefined;

  // Extract from HTTP headers
  if (req && req.headers) {
    const headers = normalizeKeys(req.headers);
    const authorizationHeader = headers.authorization;
    if (typeof authorizationHeader === "string") {
      token = authorizationHeader.replace("Bearer ", "");
    }
    if (
      headers["x-selected-campaign-id"] &&
      typeof headers["x-selected-campaign-id"] === "string"
    ) {
      selectedCampaignId = headers["x-selected-campaign-id"] as string;
    }
  }

  // Extract from WebSocket connection params
  if (connectionParams) {
    const params = normalizeKeys(connectionParams);

    // Get authorization token if not already set
    if (!token) {
      const authorizationParam = params.authorization;
      if (typeof authorizationParam === "string") {
        token = authorizationParam.replace("Bearer ", "");
      }
    }

    // Get selected campaign ID from connection params
    if (!selectedCampaignId) {
      const campaignIdParam = params["x-selected-campaign-id"];
      if (typeof campaignIdParam === "string") {
        selectedCampaignId = campaignIdParam;
      }
    }
  }

  const context: ServerContext = {
    token,
    pubsub: PubSub,
    user: null,
    selectedCampaignId,
    // Create fresh DataLoader instances for each request
    loaders: {
      threadsByCampaignId: createThreadsByCampaignIdLoader(),
    },
  };

  if (token) {
    try {
      const verifyUserResult = await verifyUser(token);
      if (verifyUserResult && verifyUserResult.user) {
        context.user = verifyUserResult.user;
      }
    } catch (error) {
      logger.warn("Error verifying token, likely it is expired.", error);
      // Do not throw error here; we'll handle it in graphql-shield
    }
  }

  return context;
};

// Helper function to normalize object keys to lowercase
function normalizeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}
