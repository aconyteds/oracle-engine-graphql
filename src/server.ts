import { ApolloServer } from "@apollo/server";
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
import { logger } from "./utils/logger";

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
      logger.error(
        "GraphQL Error",
        error instanceof Error
          ? error
          : new Error(String(formattedError.message)),
        { formattedError }
      );

      return formattedError;
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
