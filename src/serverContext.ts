import { PrismaClient } from "@prisma/client";
import { initializeFirebase, verifyUser } from "./data/Firebase";

export interface Context {
  // The Prisma client instance for database operations.
  db: PrismaClient;
  // The Firebase Auth token, if available.
  token?: string;
  // The ID of the currently logged in user within the database, if available.
  userId?: string;
}

// Initialize Firebase Admin SDK
initializeFirebase();

const db = new PrismaClient();

export const getContext = async ({ req }: { req: any }): Promise<Context> => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const context: Context = { db, token };

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
