import type { User } from "./data/MongoDB";
import { initializeFirebase, verifyUser } from "./data/Firebase";
import PubSub from "./graphql/topics";

export interface ServerContext {
  // The Firebase Auth token, if available.
  token?: string;
  // The Currently logged in user
  user?: User;
  // The PubSub instance for publishing and subscribing to events.
  pubsub: typeof PubSub;
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

  if (req && req.headers) {
    const headers = normalizeKeys(req.headers);
    if (headers.authorization) {
      token = (headers.authorization as string).replace("Bearer ", "");
    }
  }

  if (connectionParams && !token) {
    const params = normalizeKeys(connectionParams);
    if (params.authorization) {
      token = (params.authorization as string).replace("Bearer ", "");
    }
  }

  const context: ServerContext = { token, pubsub: PubSub };

  if (token) {
    try {
      const user = await verifyUser(token);
      if (user && user.user) {
        context.user = user.user as User;
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      // Do not throw error here; we'll handle it in graphql-shield
    }
  }

  return context;
};

// Helper function to normalize object keys to lowercase
function normalizeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj).reduce(
    (acc, key) => {
      acc[key.toLowerCase()] = obj[key] as unknown;
      return acc;
    },
    {} as Record<string, unknown>
  );
}
