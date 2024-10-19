import { PrismaClient } from "@prisma/client";
import { initializeFirebase, verifyUser } from "./data/Firebase";
import PubSub from "./graphql/topics";

export interface Context {
  // The Prisma client instance for database operations.
  db: PrismaClient;
  // The Firebase Auth token, if available.
  token?: string;
  // The ID of the currently logged in user within the database, if available.
  userId?: string;
  // The PubSub instance for publishing and subscribing to events.
  pubsub: typeof PubSub;
}

// Initialize Firebase Admin SDK
initializeFirebase();

const db = new PrismaClient();

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
  } else if (connectionParams) {
    const params = normalizeKeys(connectionParams);
    if (params.authorization) {
      token = (params.authorization as string).replace("Bearer ", "");
    }
  }

  const context: Context = { db, token, pubsub: PubSub };

  if (token) {
    try {
      const user = await verifyUser(token, db);
      if (user && user.user) {
        context.userId = user.user.id;
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      // Do not throw error here; we'll handle it in graphql-shield
    }
  }

  return context;
};

// Helper function to normalize object keys to lowercase
const normalizeKeys = (obj: Record<string, any>): Record<string, any> => {
  return Object.keys(obj).reduce(
    (acc, key) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    },
    {} as Record<string, any>
  );
};
