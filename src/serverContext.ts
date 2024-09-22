import { PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { initializeFirebase, verifyUser } from "./data/Firebase";

const PUBLIC_OPERATIONS = ["login", "healthCheck", "IntrospectionQuery"];

export interface Context {
  // The MongoDB client
  db: PrismaClient;
  // The Firebase Auth token
  token?: string;
  // The ID of the currently logged in user (within the DB)
  userId?: string;
}

// Initialize Firebase Admin SDK
initializeFirebase();

const db = new PrismaClient();

export const getContext = async ({ req }: { req: any }): Promise<Context> => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const context: Context = { db, token };
  const operationName = req.body?.operationName || "";

  // Check if the operation is public
  const isPublicOperation = PUBLIC_OPERATIONS.includes(operationName);

  if (isPublicOperation) {
    return context;
  }

  if (token) {
    try {
      const user = await verifyUser(token, db);
      if (!user) {
        throw new Error("Invalid token");
      }

      return { ...context, userId: user.user?.id };
    } catch (error) {
      // If the operation is not public, throw an error
      console.error("Error verifying token:", error);
      if (process.env.NODE_ENV !== "test") {
        throw new GraphQLError("Invalid authorization token", {
          extensions: {
            code: ApolloServerErrorCode.BAD_REQUEST,
          },
        });
      }
    }
  }

  return context;
};
