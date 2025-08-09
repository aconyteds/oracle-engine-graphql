import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import express, { json } from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import type { GraphQLFormattedError } from "graphql";
import { applyMiddleware } from "graphql-middleware";

import type { ServerContext } from "./serverContext";
import { getContext } from "./serverContext";
import GraphQLApplication from "./modules";
import { permissions } from "./graphql/permissions";

const graphqlServer = async (path: string = "/graphql") => {
  const isProd = process.env.NODE_ENV === "production";
  const app = express();
  app.use(cors());
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path,
  });

  const { schema, createApolloExecutor, createSubscription } =
    GraphQLApplication;
  // Apply permissions to the schema
  const schemaWithPermissions = applyMiddleware(schema, permissions);
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
      subscribe: createSubscription(),
    },
    wsServer
  );

  const apolloServer = new ApolloServer<ServerContext>({
    gateway: {
      async load() {
        return { executor: createApolloExecutor() };
      },
      onSchemaLoadOrUpdate(callback) {
        callback({ apiSchema: schemaWithPermissions, coreSupergraphSdl: "" });
        return () => {};
      },
      async stop() {},
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (formattedError: GraphQLFormattedError, _error: unknown) => {
      console.error("FORMATTED ERROR -----> ", formattedError);
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
