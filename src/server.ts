import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import express, { json } from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
import GraphQLApplication from "./modules";
import { useServer } from "graphql-ws/lib/use/ws";
import { GraphQLFormattedError } from "graphql";
import { Context, getContext } from "./serverContext";

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
  const serverCleanup = useServer(
    { schema, context: getContext, subscribe: createSubscription() },
    wsServer
  );

  const apolloServer = new ApolloServer<Context>({
    gateway: {
      async load() {
        return { executor: createApolloExecutor() };
      },
      onSchemaLoadOrUpdate(callback) {
        callback({ apiSchema: schema } as any);
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
    formatError: (formattedError: GraphQLFormattedError, error: any) => {
      console.log("FORMATTED ERROR -----> ", formattedError);
      console.log("ERROR -----> ", error);
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
