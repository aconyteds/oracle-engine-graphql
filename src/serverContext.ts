import { PrismaClient } from "@prisma/client";
import {
  DocumentNode,
  GraphQLError,
  OperationDefinitionNode,
  parse,
} from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { initializeFirebase, verifyUser } from "./data/Firebase";
import { collectFieldNames, collectFragmentDefinitions } from "./graphql";

const PUBLIC_OPERATIONS = [
  "login",
  "healthCheck",
  // Introspection Query Fields
  "__schema",
  "queryType",
  "name",
  "mutationType",
  "subscriptionType",
  "types",
  "kind",
  "description",
  "fields",
  "args",
  "type",
  "ofType",
  "defaultValue",
  "isDeprecated",
  "deprecationReason",
  "inputFields",
  "interfaces",
  "enumValues",
  "possibleTypes",
  "directives",
  "locations",
];

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
 * Generates the context for a GraphQL request, ensuring that protected operations
 * require a valid authentication token.
 * @param {Object} params - The parameters for the context function.
 * @param {any} params.req - The HTTP request object.
 * @returns {Promise<Context>} The context for the GraphQL operation.
 * @throws {GraphQLError} Throws an error if the authorization token is invalid or missing for protected operations.
 */
export const getContext = async ({ req }: { req: any }): Promise<Context> => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const context: Context = { db, token };
  const query = req.body?.query;

  if (!query) {
    throw new GraphQLError("No query provided", {
      extensions: {
        code: ApolloServerErrorCode.BAD_REQUEST,
      },
    });
  }

  let isPublicOperation = true;

  try {
    // Parse the GraphQL query
    const parsedQuery: DocumentNode = parse(query);
    const fragmentDefinitions = collectFragmentDefinitions(parsedQuery);
    const fieldNames: string[] = [];

    // Iterate over definitions to collect field names
    for (const definition of parsedQuery.definitions) {
      if (definition.kind === "OperationDefinition") {
        const operation = definition as OperationDefinitionNode;
        const selectionSet = operation.selectionSet;
        const operationFieldNames = collectFieldNames(
          selectionSet,
          fragmentDefinitions
        );
        fieldNames.push(...operationFieldNames);
      }
    }

    // Check if any of the field names are not public
    const hasPrivateFields = fieldNames.some(
      (fieldName) => !PUBLIC_OPERATIONS.includes(fieldName)
    );

    if (hasPrivateFields) {
      isPublicOperation = false;
    }
  } catch (error) {
    console.error("Error parsing query:", error);
    throw new GraphQLError("Invalid query", {
      extensions: {
        code: ApolloServerErrorCode.BAD_REQUEST,
      },
    });
  }

  if (isPublicOperation) {
    // Return context without requiring authentication
    return context;
  }

  // Require authentication for protected operations
  if (token) {
    try {
      const user = await verifyUser(token, db);
      if (!user) {
        throw new Error("Invalid token");
      }
      return { ...context, userId: user.user?.id };
    } catch (error) {
      console.error("Error verifying token:", error);
    }
  }

  throw new GraphQLError("Invalid or missing authorization token", {
    extensions: {
      code: ApolloServerErrorCode.BAD_REQUEST,
    },
  });
};
