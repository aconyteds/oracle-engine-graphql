import { ApolloServer } from "@apollo/server";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { setupExpressErrorHandler } from "@sentry/bun";
import cors from "cors";
import express, { json } from "express";
import type { GraphQLFormattedError } from "graphql";
import { applyMiddleware } from "graphql-middleware";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import { WebSocketServer } from "ws";
import { permissions } from "./graphql/permissions";
import GraphQLApplication from "./modules";
import type { ServerContext } from "./serverContext";
import { getContext } from "./serverContext";

/**
 * Valid Apollo Server error codes that can be returned to clients.
 * These are the standard error codes that should be exposed.
 */
export const ALLOWED_ERROR_CODES = new Set([
  ApolloServerErrorCode.GRAPHQL_PARSE_FAILED,
  ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED,
  ApolloServerErrorCode.BAD_USER_INPUT,
  ApolloServerErrorCode.BAD_REQUEST,
  ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
  ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND,
  ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED,
  ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE,
  "INACTIVE_USER", // Custom error code from our application
  "UNAUTHENTICATED", // Custom error code for unauthenticated access
]);

/**
 * Sanitizes GraphQL errors to prevent exposing internal infrastructure details.
 * In production, removes stack traces and sanitizes error messages.
 * Ensures all errors use allowed GraphQL error codes.
 *
 * @param formattedError - The formatted error from GraphQL
 * @param isProduction - Whether the server is running in production mode
 * @returns Sanitized error safe for client consumption
 */
export function sanitizeGraphQLError(
  formattedError: GraphQLFormattedError,
  isProduction: boolean
): GraphQLFormattedError {
  const errorCode = formattedError.extensions?.code as string | undefined;

  // Validate error code - if not in allowed list, use INTERNAL_SERVER_ERROR
  const validCode =
    errorCode && ALLOWED_ERROR_CODES.has(errorCode)
      ? errorCode
      : ApolloServerErrorCode.INTERNAL_SERVER_ERROR;

  // In production, sanitize the error
  if (isProduction) {
    // For internal server errors, provide a generic message
    const sanitizedMessage =
      validCode === ApolloServerErrorCode.INTERNAL_SERVER_ERROR
        ? "An internal server error occurred"
        : formattedError.message;

    return {
      message: sanitizedMessage,
      // locations: line/column in the GraphQL query where error occurred (safe to expose)
      // path: field path in GraphQL response where error happened (safe to expose)
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: validCode,
        // Remove all other extension fields that might contain sensitive info
      },
    };
  }

  // In development, keep full error but ensure valid code
  return {
    ...formattedError,
    extensions: {
      ...formattedError.extensions,
      code: validCode,
    },
  };
}

const graphqlServer = async (path: string = "/graphql") => {
  const isProd = process.env.NODE_ENV === "production";
  const app = express();
  if (process.env.SENTRY_DSN && isProd) {
    setupExpressErrorHandler(app);
  }
  app.use(cors());
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path,
  });

  const schemaWithPermissions = applyMiddleware(
    GraphQLApplication.schema,
    permissions
  );
  const serverCleanup = useServer(
    {
      schema: schemaWithPermissions,
      context: async (ctx) => {
        const currContext = await getContext({
          connectionParams: ctx.connectionParams,
          req: ctx.extra.request,
        });
        return currContext;
      },
      subscribe: GraphQLApplication.createSubscription(),
    },
    wsServer
  );

  const apolloServer = new ApolloServer<ServerContext>({
    gateway: {
      load() {
        return Promise.resolve({
          executor: GraphQLApplication.createApolloExecutor(),
        });
      },
      onSchemaLoadOrUpdate(callback) {
        callback({ apiSchema: schemaWithPermissions, coreSupergraphSdl: "" });
        return () => {};
      },
      async stop() {
        return Promise.resolve();
      },
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          await Promise.resolve();
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (formattedError: GraphQLFormattedError, error: unknown) => {
      // Log full error details for debugging (server-side only)
      console.error(
        "GraphQL Error:",
        error instanceof Error
          ? error
          : new Error(String(formattedError.message)),
        formattedError
      );

      // Sanitize error for client response
      const sanitizedError = sanitizeGraphQLError(formattedError, isProd);
      return sanitizedError;
    },
    introspection: !isProd,
  });

  await apolloServer.start();

  app.use(
    path,
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(apolloServer, {
      context: getContext,
    })
  );

  return { app, httpServer, apolloServer };
};

export default graphqlServer;
