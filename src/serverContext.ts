import { PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { initializeFirebase, verifyUser } from "./data/Firebase";

const PUBLIC_OPERATIONS = ["login", "healthCheck", "IntrospectionQuery"];

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

/**
 * Generates the context for a GraphQL request.
 * @param {Object} params - The parameters for the context function.
 * @param {any} params.req - The HTTP request object.
 * @returns {Promise<Context>} The context for the GraphQL operation.
 * @throws {GraphQLError} Throws an error if the authorization token is invalid.
 */
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
