import { initializeFirebase, verifyUser } from "./data/Firebase";
import type { User } from "./data/MongoDB";
import PubSub from "./graphql/topics";
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

  if (req && req.headers) {
    const headers = normalizeKeys(req.headers);
    const authorizationHeader = headers.authorization;
    if (typeof authorizationHeader === "string") {
      token = authorizationHeader.replace("Bearer ", "");
    }
    if (
      req.headers["x-selected-campaign-id"] &&
      typeof req.headers["x-selected-campaign-id"] === "string"
    ) {
      selectedCampaignId = req.headers["x-selected-campaign-id"];
    }
  }

  if (connectionParams && !token) {
    const params = normalizeKeys(connectionParams);
    const authorizationParam = params.authorization;
    if (typeof authorizationParam === "string") {
      token = authorizationParam.replace("Bearer ", "");
    }
  }

  const context: ServerContext = {
    token,
    pubsub: PubSub,
    user: null,
    selectedCampaignId,
  };

  if (token) {
    try {
      const verifyUserResult = await verifyUser(token);
      if (verifyUserResult && verifyUserResult.user) {
        context.user = verifyUserResult.user;
      }
    } catch (error) {
      logger.error("Error verifying token:", error);
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
