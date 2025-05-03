import { User } from "./data/MongoDB";
import { initializeFirebase, verifyUser } from "./data/Firebase";
import PubSub from "./graphql/topics";

export interface Context {
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
  req?: any;
  connectionParams?: any;
}): Promise<Context> => {
  let token = "";

  if (req && req.headers) {
    const headers = normalizeKeys(req.headers);
    if (headers.authorization) {
      token = headers.authorization.replace("Bearer ", "");
    }
  }

  if (connectionParams && !token) {
    const params = normalizeKeys(connectionParams);
    if (params.authorization) {
      token = (params.authorization as string).replace("Bearer ", "");
    }
  }

  const context: Context = { token, pubsub: PubSub };

  if (token) {
    try {
      const user = await verifyUser(token);
      if (user && user.user) {
        context.user = user.user;
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      // Do not throw error here; we'll handle it in graphql-shield
    }
  }

  return context;
};

// Helper function to normalize object keys to lowercase
function normalizeKeys(obj: Record<string, any>): Record<string, any> {
  return Object.keys(obj).reduce(
    (acc, key) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    },
    {} as Record<string, any>
  );
}
